// Interrogator - Sequential Q&A with agent to clarify validation failures
// Asks specific questions about failed criteria and collects agent responses

import { Task, InterrogationResult, InterrogationSession } from './types';
import { CLIAdapter } from './cliAdapter';
import { MinimalState } from './promptBuilder';
import { log as logShared, logVerbose } from './logger';
import { appendPromptLog } from './promptLogger';
import * as path from 'path';
import * as fs from 'fs/promises';

function log(message: string, ...args: unknown[]): void {
  logShared('Interrogator', message, ...args);
}

interface InterrogationAgentResponse {
  results: {
    [criterion: string]: {
      status: "COMPLETE" | "INCOMPLETE" | "NOT_STARTED";
      file_paths: string[];
      evidence_snippet?: string;
    }
  }
}

/**
 * Validate agent response deterministically (no LLM)
 * Checks file existence and content
 */
async function validateInterrogationResponse(
  criteria: string[],
  agentResponse: string,
  sandboxRoot: string
): Promise<{ [criterion: string]: { result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] } }> {
  log(`Validating interrogation response deterministically`);
  
  const results: { [criterion: string]: { result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] } } = {};
  
  // Initialize all as UNCERTAIN/INCOMPLETE first
  for (const c of criteria) {
    results[c] = { result: 'UNCERTAIN', reason: 'No data provided', file_paths: [] };
  }

  try {
    // Parse JSON
    let parsed: InterrogationAgentResponse | null = null;
    const jsonMatch = agentResponse.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        log(`JSON parse error: ${e}`);
      }
    }

    if (!parsed || !parsed.results) {
      log('Invalid JSON response format');
      return criteria.reduce((acc, c) => ({
        ...acc,
        [c]: { result: 'UNCERTAIN', reason: 'Invalid JSON response format from agent', file_paths: [] }
      }), {});
    }

    // Validate each criterion
    for (const criterion of criteria) {
      const agentResult = parsed.results[criterion];
      
      if (!agentResult) {
        results[criterion] = { 
          result: 'INCOMPLETE', 
          reason: 'Agent did not provide result for this criterion', 
          file_paths: [] 
        };
        continue;
      }

      if (agentResult.status !== 'COMPLETE') {
        results[criterion] = { 
          result: 'INCOMPLETE', 
          reason: `Agent reported status: ${agentResult.status}`, 
          file_paths: agentResult.file_paths || []
        };
        continue;
      }

      // Check files
      if (!agentResult.file_paths || agentResult.file_paths.length === 0) {
        // If it's a design task, maybe no files? But we requested file paths.
        // For now, assume incomplete if no files for "COMPLETE" status unless explained?
        // But our protocol demands file paths.
        results[criterion] = { 
          result: 'UNCERTAIN', 
          reason: 'Marked COMPLETE but no file paths provided', 
          file_paths: [] 
        };
        continue;
      }

      const validFiles: string[] = [];
      const missingFiles: string[] = [];

      for (const filePath of agentResult.file_paths) {
        const fullPath = path.join(sandboxRoot, filePath);
        try {
          await fs.access(fullPath);
          validFiles.push(filePath);
        } catch {
          missingFiles.push(filePath);
        }
      }

      if (missingFiles.length > 0) {
        results[criterion] = { 
          result: 'INCOMPLETE', 
          reason: `Files not found: ${missingFiles.join(', ')}`, 
          file_paths: validFiles 
        };
      } else {
        results[criterion] = { 
          result: 'COMPLETE', 
          reason: 'All files verified to exist', 
          file_paths: validFiles 
        };
      }
    }

  } catch (error) {
    log(`Validation error: ${error}`);
    return criteria.reduce((acc, c) => ({
      ...acc,
      [c]: { result: 'UNCERTAIN', reason: `Validation error: ${error}`, file_paths: [] }
    }), {});
  }

  return results;
}

/**
 * Build batched interrogation prompt for multiple criteria
 */
async function buildBatchedInterrogationPrompt(
  task: Task,
  criteria: string[],
  questionNumber: number,
  maxQuestions: number,
  minimalState: MinimalState,
  previousRoundResponses: { [criterion: string]: InterrogationResult[] } | undefined,
  sandboxCwd: string,
  cliAdapter: CLIAdapter
): Promise<string> {
  const sections: string[] = [];
  
  sections.push('## Interrogation Request');
  sections.push(`You are being asked to clarify where you implemented the following acceptance criteria.`);
  sections.push(`You MUST respond with a strict JSON object.`);
  sections.push('');
  
  // List all criteria
  sections.push('**Criteria to clarify:**');
  criteria.forEach((criterion, index) => {
    sections.push(`${index + 1}. ${criterion}`);
  });
  sections.push('');
  
  sections.push(`**Question ${questionNumber} of ${maxQuestions}:**`);
  sections.push('');
  
  // Include previous responses if this is a follow-up round
  if (previousRoundResponses && Object.keys(previousRoundResponses).length > 0) {
    sections.push('## Previous Errors');
    for (const [criterion, responses] of Object.entries(previousRoundResponses)) {
      if (responses.length > 0) {
        const lastResponse = responses[responses.length - 1];
        if (lastResponse.analysis_result !== 'COMPLETE') {
            sections.push(`**Criterion:** ${criterion}`);
            sections.push(`- **Issue:** ${lastResponse.analysis_reason}`);
            sections.push('');
        }
      }
    }
    sections.push('## Current Request');
  }
  
  sections.push(`Please provide the location of the implementation for EACH criterion.`);
  sections.push(`If a file path you provided previously was incorrect (e.g., "File not found"), provide the CORRECT path.`);
  sections.push('');
  sections.push(`**REQUIRED RESPONSE FORMAT (JSON ONLY):**`);
  sections.push('```json');
  sections.push('{');
  sections.push('  "results": {');
  sections.push(`    "${criteria[0]}": {`);
  sections.push('      "status": "COMPLETE" | "INCOMPLETE" | "NOT_STARTED",');
  sections.push('      "file_paths": ["src/path/to/file.ts"],');
  sections.push('      "evidence_snippet": "optional code snippet proving implementation"');
  sections.push('    }');
  sections.push('  }');
  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push(`**Important:**`);
  sections.push(`- Return ONLY the JSON object.`);
  sections.push(`- Ensure "file_paths" are relative to: ${minimalState.project.sandbox_root}`);
  sections.push(`- Verify the files actually exist before responding.`);
  
  return sections.join('\n');
}

/**
 * Interrogate agent about failed criteria
 * BATCHED: All criteria in one prompt per round, max 4 rounds
 * ALWAYS: Prompt → Response → Prompt (never two prompts without response)
 */
export async function interrogateAgent(
  task: Task,
  failedCriteria: string[],
  uncertainCriteria: string[],
  minimalState: MinimalState,
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  maxQuestionsPerCriterion: number = 2, // Default reduced to 2 per Enhanced Strategy
  sandboxRoot?: string,
  projectId?: string
): Promise<InterrogationSession> {
  log(`Starting BATCHED interrogation for task: ${task.task_id}`);
  log(`Failed criteria: ${failedCriteria.length}, Uncertain criteria: ${uncertainCriteria.length}`);
  logVerbose('Interrogator', 'Batched interrogation started', {
    task_id: task.task_id,
    failed_criteria_count: failedCriteria.length,
    uncertain_criteria_count: uncertainCriteria.length,
    max_rounds: maxQuestionsPerCriterion,
  });

  const allCriteriaToInterrogate = [...failedCriteria, ...uncertainCriteria];
  const interrogationResults: InterrogationResult[] = [];
  let unresolvedCriteria = [...allCriteriaToInterrogate];
  const previousRoundResponses: { [criterion: string]: InterrogationResult[] } = {};
  let questionNumber = 1;

  // Process in rounds: up to maxQuestionsPerCriterion rounds
  // Each round: one prompt with ALL remaining unresolved criteria → one response → analyze all
  while (questionNumber <= maxQuestionsPerCriterion && unresolvedCriteria.length > 0) {
    log(`Round ${questionNumber}/${maxQuestionsPerCriterion}: Interrogating ${unresolvedCriteria.length} criteria`);
    logVerbose('Interrogator', 'Starting interrogation round', {
      task_id: task.task_id,
      round: questionNumber,
      max_rounds: maxQuestionsPerCriterion,
      criteria_count: unresolvedCriteria.length,
      criteria: unresolvedCriteria,
    });

    // Build batched prompt for all remaining unresolved criteria
    const interrogationPrompt = await buildBatchedInterrogationPrompt(
      task,
      unresolvedCriteria,
      questionNumber,
      maxQuestionsPerCriterion,
      minimalState,
      questionNumber > 1 ? previousRoundResponses : undefined,
      sandboxCwd,
      cliAdapter
    );

    log(`Built batched interrogation prompt for ${unresolvedCriteria.length} criteria`);
    
    // Log interrogation prompt
    if (sandboxRoot && projectId) {
      await appendPromptLog(
        {
          task_id: task.task_id,
          iteration: 0,
          type: 'INTERROGATION_PROMPT',
          content: interrogationPrompt,
          metadata: {
            agent_mode: task.agent_mode || 'auto',
            working_directory: sandboxCwd,
            prompt_length: interrogationPrompt.length,
            criteria_count: unresolvedCriteria.length,
            criteria: unresolvedCriteria,
            question_number: questionNumber,
          },
        },
        sandboxRoot,
        projectId
      );
    }

    // CRITICAL: Wait for response before continuing (Prompt → Response)
    const interrogationStartTime = Date.now();
    const cursorResult = await cliAdapter.execute(interrogationPrompt, sandboxCwd, task.agent_mode);
    const interrogationDuration = Date.now() - interrogationStartTime;
    
    log(`Batched interrogation response received in ${interrogationDuration}ms`);
    const agentResponse = cursorResult.stdout || cursorResult.rawOutput || '';

    // Validate response deterministically
    const analysisResults = await validateInterrogationResponse(
      unresolvedCriteria,
      agentResponse,
      minimalState.project.sandbox_root
    );

    // Log response
    if (sandboxRoot && projectId) {
      await appendPromptLog(
        {
          task_id: task.task_id,
          iteration: 0,
          type: 'INTERROGATION_RESPONSE',
          content: agentResponse,
          metadata: {
            agent_mode: task.agent_mode || 'auto',
            working_directory: sandboxCwd,
            response_length: agentResponse.length,
            stdout_length: cursorResult.stdout?.length || 0,
            stderr_length: cursorResult.stderr?.length || 0,
            exit_code: cursorResult.exitCode,
            duration_ms: interrogationDuration,
            criteria_count: unresolvedCriteria.length,
            criteria: unresolvedCriteria,
            question_number: questionNumber,
            analysis_results: analysisResults,
          },
        },
        sandboxRoot,
        projectId
      );
    }

    // Process analysis results for each criterion
    const newlyResolved: string[] = [];
    const stillUnresolved: string[] = [];

    for (const criterion of unresolvedCriteria) {
      const analysis = analysisResults[criterion] || { result: 'UNCERTAIN' as const, reason: 'No analysis result', file_paths: [] };
      
      const interrogationResult: InterrogationResult = {
        criterion,
        question: `Round ${questionNumber}: Where are these criteria implemented?`,
        agent_response: agentResponse,
        analysis_result: analysis.result,
        analysis_reason: analysis.reason,
        file_paths_found: analysis.file_paths || [],
        question_number: questionNumber,
      };

      interrogationResults.push(interrogationResult);
      
      // Track responses per criterion for next round
      if (!previousRoundResponses[criterion]) {
        previousRoundResponses[criterion] = [];
      }
      previousRoundResponses[criterion].push(interrogationResult);

      if (analysis.result === 'COMPLETE') {
        log(`✅ Criterion "${criterion}" confirmed COMPLETE in round ${questionNumber}`);
        newlyResolved.push(criterion);
      } else {
        // Enhanced Conditional Logic: Check for explicit admission of failure
        const isExplicitFailure = analysis.reason.includes('Agent reported status: NOT_STARTED') || 
                                 analysis.reason.includes('Agent reported status: INCOMPLETE');
        
        if (isExplicitFailure) {
          log(`🛑 Criterion "${criterion}" explicitly marked INCOMPLETE/NOT_STARTED by agent. Dropping from further interrogation.`);
          // Do NOT add to stillUnresolved - we stop asking about this one.
        } else {
          log(`⚠️ Criterion "${criterion}" still ${analysis.result} after round ${questionNumber}. Reason: ${analysis.reason}`);
          stillUnresolved.push(criterion);
        }
      }
    }

    log(`Round ${questionNumber} results: ${newlyResolved.length} resolved, ${stillUnresolved.length} queued for next round`);

    // "Stop the Line" Logic: If Round 1 yielded 0 successes and everyone failed explicitly (or just failed), 
    // and we have nothing left to ask about (or we decide 0% success is enough to halt).
    // Logic: If stillUnresolved is empty but we had failures (explicit ones dropped), loop ends naturally.
    
    // Update unresolved criteria for next round
    unresolvedCriteria = stillUnresolved;

    // If all criteria resolved or dropped, stop early
    if (unresolvedCriteria.length === 0) {
      log(`✅ All criteria resolved or explicitly failed after ${questionNumber} round(s)`);
      break;
    }

    questionNumber++;
  }

  const remainingFailedCriteria = unresolvedCriteria;
  const allCriteriaSatisfied = remainingFailedCriteria.length === 0;
  
  log(`Batched interrogation completed. All satisfied: ${allCriteriaSatisfied}`);
  log(`Remaining failed criteria: ${remainingFailedCriteria.length}`);
  logVerbose('Interrogator', 'Batched interrogation session completed', {
    task_id: task.task_id,
    total_rounds: questionNumber - 1,
    total_questions: interrogationResults.length,
    all_criteria_satisfied: allCriteriaSatisfied,
    remaining_failed_criteria_count: remainingFailedCriteria.length,
  });

  return {
    task_id: task.task_id,
    failed_criteria: allCriteriaToInterrogate,
    interrogation_results: interrogationResults,
    all_criteria_satisfied: allCriteriaSatisfied,
    remaining_failed_criteria: remainingFailedCriteria,
  };
}

