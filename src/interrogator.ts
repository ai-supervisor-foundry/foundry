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

/**
 * Build interrogation prompt for a specific criterion
 */
function buildInterrogationPrompt(
  task: Task,
  criterion: string,
  questionNumber: number,
  maxQuestions: number,
  minimalState: MinimalState,
  previousResponses?: InterrogationResult[]
): string {
  const sections: string[] = [];

  sections.push('## Interrogation Request');
  sections.push(`You are being asked to clarify where you implemented the following acceptance criterion:`);
  sections.push('');
  sections.push(`**Criterion:** ${criterion}`);
  sections.push('');
  sections.push(`**Question ${questionNumber} of ${maxQuestions}:**`);
  sections.push('');
  
  if (previousResponses && previousResponses.length > 0) {
    sections.push('## Previous Responses');
    for (const prev of previousResponses) {
      sections.push(`- **Question:** ${prev.question}`);
      sections.push(`  **Your Response:** ${prev.agent_response}`);
      sections.push('');
    }
    sections.push('## Current Question');
  }
  
  sections.push(`Please provide ONE of the following:`);
  sections.push(`1. The exact file path(s) where this criterion is implemented (relative to ${minimalState.project.sandbox_root})`);
  sections.push(`2. A detailed explanation of how this criterion was satisfied`);
  sections.push(`3. If this is a design/planning task, where the design document or specification is located`);
  sections.push('');
  sections.push(`**Important:**`);
  sections.push(`- Be specific and concrete`);
  sections.push(`- Provide file paths if applicable`);
  sections.push(`- If you haven't implemented this yet, say so explicitly`);
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');

  return sections.join('\n');
}

/**
 * Interrogate agent about failed criteria
 * Sequential Q&A with max 4 questions per criterion
 */
export async function interrogateAgent(
  task: Task,
  failedCriteria: string[],
  uncertainCriteria: string[],
  minimalState: MinimalState,
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  maxQuestionsPerCriterion: number = 4,
  sandboxRoot?: string,
  projectId?: string
): Promise<InterrogationSession> {
  log(`Starting interrogation for task: ${task.task_id}`);
  log(`Failed criteria: ${failedCriteria.length}, Uncertain criteria: ${uncertainCriteria.length}`);
  logVerbose('Interrogator', 'Interrogation started', {
    task_id: task.task_id,
    failed_criteria_count: failedCriteria.length,
    uncertain_criteria_count: uncertainCriteria.length,
    max_questions: maxQuestionsPerCriterion,
  });

  const allCriteriaToInterrogate = [...failedCriteria, ...uncertainCriteria];
  const interrogationResults: InterrogationResult[] = [];
  const remainingFailedCriteria: string[] = [];

  for (const criterion of allCriteriaToInterrogate) {
    log(`Interrogating criterion: "${criterion}"`);
    logVerbose('Interrogator', 'Interrogating criterion', {
      task_id: task.task_id,
      criterion,
      question_number: 1,
    });

    const previousResponses: InterrogationResult[] = [];
    let questionNumber = 1;
    let analysisResult: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN' = 'UNCERTAIN';

    while (questionNumber <= maxQuestionsPerCriterion) {
      // Build interrogation prompt
      const interrogationPrompt = buildInterrogationPrompt(
        task,
        criterion,
        questionNumber,
        maxQuestionsPerCriterion,
        minimalState,
        previousResponses.length > 0 ? previousResponses : undefined
      );

      log(`Asking question ${questionNumber}/${maxQuestionsPerCriterion} for criterion: "${criterion}"`);
      logVerbose('Interrogator', 'Executing interrogation question', {
        task_id: task.task_id,
        criterion,
        question_number: questionNumber,
        prompt_length: interrogationPrompt.length,
      });

      // Log interrogation prompt to prompts.log.jsonl
      if (sandboxRoot && projectId) {
        await appendPromptLog(
          {
            task_id: task.task_id,
            iteration: 0, // Interrogation doesn't have iteration number, use 0
            type: 'INTERROGATION_PROMPT',
            content: interrogationPrompt,
            metadata: {
              agent_mode: task.agent_mode || 'auto',
              working_directory: sandboxCwd,
              prompt_length: interrogationPrompt.length,
              criterion,
              question_number: questionNumber,
            },
          },
          sandboxRoot,
          projectId
        );
      }

      // Execute interrogation via Cursor CLI
      const interrogationStartTime = Date.now();
      const cursorResult = await cliAdapter.execute(interrogationPrompt, sandboxCwd, task.agent_mode);
      const interrogationDuration = Date.now() - interrogationStartTime;
      
      log(`Interrogation response received in ${interrogationDuration}ms`);
      logVerbose('Interrogator', 'Interrogation response received', {
        task_id: task.task_id,
        criterion,
        question_number: questionNumber,
        response_length: cursorResult.stdout?.length || 0,
        exit_code: cursorResult.exitCode,
      });

      const agentResponse = cursorResult.stdout || cursorResult.rawOutput || '';

      // Analyze response using internal agent
      const analysisStartTime = Date.now();
      const analysis = await analyzeAgentResponse(
        criterion,
        agentResponse,
        sandboxCwd,
        cliAdapter,
        task.agent_mode
      );
      const analysisDuration = Date.now() - analysisStartTime;

      // Log interrogation response to prompts.log.jsonl (after analysis to include analysis_result)
      if (sandboxRoot && projectId) {
        await appendPromptLog(
          {
            task_id: task.task_id,
            iteration: 0, // Interrogation doesn't have iteration number, use 0
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
              criterion,
              question_number: questionNumber,
              analysis_result: analysis.result,
            },
          },
          sandboxRoot,
          projectId
        );
      }
      
      log(`Analysis result: ${analysis.result} (${analysisDuration}ms)`);
      logVerbose('Interrogator', 'Analysis completed', {
        task_id: task.task_id,
        criterion,
        question_number: questionNumber,
        analysis_result: analysis.result,
        analysis_reason: analysis.reason,
        file_paths_found: analysis.file_paths?.length || 0,
      });

      // Store interrogation result
      const interrogationResult: InterrogationResult = {
        criterion,
        question: `Question ${questionNumber}: Where is "${criterion}" implemented?`,
        agent_response: agentResponse,
        analysis_result: analysis.result,
        analysis_reason: analysis.reason,
        file_paths_found: analysis.file_paths,
        question_number: questionNumber,
      };

      previousResponses.push(interrogationResult);
      interrogationResults.push(interrogationResult);

      // If analysis confirms COMPLETE, stop asking questions for this criterion
      if (analysis.result === 'COMPLETE') {
        log(`✅ Criterion "${criterion}" confirmed COMPLETE by internal agent`);
        analysisResult = 'COMPLETE';
        break;
      }

      // If analysis confirms INCOMPLETE, stop asking questions
      if (analysis.result === 'INCOMPLETE') {
        log(`❌ Criterion "${criterion}" confirmed INCOMPLETE by internal agent`);
        analysisResult = 'INCOMPLETE';
        break;
      }

      // If still UNCERTAIN and more questions allowed, continue
      questionNumber++;
    }

    // After interrogation, if still not COMPLETE, add to remaining failed criteria
    if (analysisResult !== 'COMPLETE') {
      remainingFailedCriteria.push(criterion);
      log(`⚠️ Criterion "${criterion}" remains unresolved after ${maxQuestionsPerCriterion} questions`);
    }
  }

  const allCriteriaSatisfied = remainingFailedCriteria.length === 0;
  
  log(`Interrogation completed. All satisfied: ${allCriteriaSatisfied}`);
  log(`Remaining failed criteria: ${remainingFailedCriteria.length}`);
  logVerbose('Interrogator', 'Interrogation session completed', {
    task_id: task.task_id,
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

/**
 * Analyze agent response using internal agent (Cursor CLI)
 * Determines if work is COMPLETE, INCOMPLETE, or UNCERTAIN
 */
async function analyzeAgentResponse(
  criterion: string,
  agentResponse: string,
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  agentMode?: string
): Promise<{ result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] }> {
  log(`Analyzing agent response for criterion: "${criterion}"`);
  logVerbose('Interrogator', 'Starting internal agent analysis', {
    criterion,
    response_length: agentResponse.length,
  });

  // Build analysis prompt for internal agent
  const analysisPrompt = `## Analysis Task

You are analyzing an agent's response to determine if an acceptance criterion has been satisfied.

**Criterion:** ${criterion}

**Agent's Response:**
${agentResponse}

**Working Directory:** ${sandboxCwd}

**Instructions:**
1. Check if the agent provided file paths. If so, verify those files exist and contain relevant content.
2. Check if the agent provided a detailed explanation that demonstrates the criterion is satisfied.
3. Check if the agent explicitly stated the work is incomplete or not done.
4. For design/planning tasks, check if documentation or design files exist.

**Output Format:**
Respond with a JSON object:
{
  "result": "COMPLETE" | "INCOMPLETE" | "UNCERTAIN",
  "reason": "Brief explanation of your analysis",
  "file_paths": ["path1", "path2"] // if files were mentioned
}

**Analysis Rules:**
- COMPLETE: Files exist and contain relevant content, OR explanation is sufficient for design tasks
- INCOMPLETE: Agent explicitly states work not done, OR files don't exist, OR files are empty
- UNCERTAIN: Cannot determine from response, need more information

Be strict but fair. Only mark COMPLETE if you can verify the work exists.`;

  // Execute analysis via Cursor CLI (use provided agentMode or default to 'auto' for internal agent)
  const analysisStartTime = Date.now();
      const cursorResult = await cliAdapter.execute(analysisPrompt, sandboxCwd, agentMode || 'auto');
  const analysisDuration = Date.now() - analysisStartTime;
  
  log(`Internal agent analysis completed in ${analysisDuration}ms`);
  logVerbose('Interrogator', 'Internal agent analysis completed', {
    criterion,
    analysis_duration_ms: analysisDuration,
    response_length: cursorResult.stdout?.length || 0,
  });

  const analysisOutput = cursorResult.stdout || cursorResult.rawOutput || '';

  // Parse analysis result
  try {
    // Try to extract JSON from response
    const jsonMatch = analysisOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        result: analysis.result || 'UNCERTAIN',
        reason: analysis.reason || 'Analysis completed',
        file_paths: analysis.file_paths || [],
      };
    }
  } catch (error) {
    log(`Failed to parse analysis JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Fallback: Check response text for indicators
  const responseLower = analysisOutput.toLowerCase();
  if (responseLower.includes('complete') && !responseLower.includes('incomplete')) {
    return {
      result: 'COMPLETE',
      reason: 'Internal agent indicated completion',
      file_paths: [],
    };
  } else if (responseLower.includes('incomplete') || responseLower.includes('not done') || responseLower.includes('missing')) {
    return {
      result: 'INCOMPLETE',
      reason: 'Internal agent indicated incompletion',
      file_paths: [],
    };
  }

  // Default to UNCERTAIN
  return {
    result: 'UNCERTAIN',
    reason: 'Could not determine from analysis response',
    file_paths: [],
  };
}

