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
 * Generate a better interrogation question using agent assistance (for 2nd question)
 */
async function generateBetterQuestion(
  criterion: string,
  task: Task,
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  previousResponses: InterrogationResult[],
  minimalState: MinimalState
): Promise<string> {
  const prompt = `You are helping generate a precise interrogation question.

Criterion: "${criterion}"
Task: ${task.intent}
Working Directory: ${sandboxCwd}
Sandbox Root: ${minimalState.project.sandbox_root}

Previous attempt:
- Question: ${previousResponses[0].question}
- Response: ${previousResponses[0].agent_response.substring(0, 500)}

Based on the criterion, task context, and the previous response, generate a SPECIFIC, targeted question that will help locate where this was implemented.

Consider:
- What file types/locations are likely (e.g., services/, components/, docs/, src/)
- What specific functionality/keywords to look for
- If this is a design task, what documentation format to expect
- What the previous response indicated (or didn't indicate)

Generate ONE specific, actionable question that will help find the implementation. Be more precise than the first question.`;

  const result = await cliAdapter.execute(prompt, sandboxCwd, 'auto');
  return result.stdout.trim();
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
  sections.push(`You are being asked to clarify where you implemented the following acceptance criteria:`);
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
    sections.push('## Previous Responses');
    for (const [criterion, responses] of Object.entries(previousRoundResponses)) {
      if (responses.length > 0) {
        sections.push(`**Criterion:** ${criterion}`);
        sections.push(`- **Question:** ${responses[responses.length - 1].question}`);
        sections.push(`  **Your Response:** ${responses[responses.length - 1].agent_response.substring(0, 300)}${responses[responses.length - 1].agent_response.length > 300 ? '...' : ''}`);
        sections.push('');
      }
    }
    sections.push('## Current Question');
  }
  
  sections.push(`Please provide information for EACH of the ${criteria.length} criteria above. For each criterion, provide ONE of the following:`);
  sections.push(`1. The exact file path(s) where this criterion is implemented (relative to ${minimalState.project.sandbox_root})`);
  sections.push(`2. A detailed explanation of how this criterion was satisfied`);
  sections.push(`3. If this is a design/planning task, where the design document or specification is located`);
  sections.push('');
  sections.push(`**Important:**`);
  sections.push(`- Be specific and concrete for each criterion`);
  sections.push(`- Provide file paths if applicable`);
  sections.push(`- If you haven't implemented a criterion yet, say so explicitly`);
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');
  sections.push(`**Format your response clearly, addressing each criterion separately.**`);
  
  return sections.join('\n');
}

/**
 * Build interrogation prompt for a specific criterion (DEPRECATED - kept for backward compatibility)
 */
async function buildInterrogationPrompt(
  task: Task,
  criterion: string,
  questionNumber: number,
  maxQuestions: number,
  minimalState: MinimalState,
  previousResponses: InterrogationResult[] | undefined,
  sandboxCwd: string,
  cliAdapter: CLIAdapter
): Promise<string> {
  // For 2nd question, use agent-assisted question generation
  if (questionNumber === 2 && previousResponses && previousResponses.length > 0) {
    log(`Generating agent-assisted question for criterion: "${criterion}"`);
    const betterQuestion = await generateBetterQuestion(
      criterion,
      task,
      sandboxCwd,
      cliAdapter,
      previousResponses,
      minimalState
    );
    
    const sections: string[] = [];
    sections.push('## Interrogation Request');
    sections.push(`You are being asked to clarify where you implemented the following acceptance criterion:`);
    sections.push('');
    sections.push(`**Criterion:** ${criterion}`);
    sections.push('');
    sections.push(`**Question ${questionNumber} of ${maxQuestions}:**`);
    sections.push('');
    sections.push('## Previous Response');
    sections.push(`- **Question:** ${previousResponses[0].question}`);
    sections.push(`  **Your Response:** ${previousResponses[0].agent_response}`);
    sections.push('');
    sections.push('## Current Question');
    sections.push(betterQuestion);
    sections.push('');
    sections.push(`**Working directory:** ${minimalState.project.sandbox_root}`);
    sections.push('');
    
    return sections.join('\n');
  }

  // Standard prompt for 1st question and subsequent questions
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
 * Analyze batched agent response for multiple criteria
 */
async function analyzeBatchedResponse(
  criteria: string[],
  agentResponse: string,
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  agentMode?: string
): Promise<{ [criterion: string]: { result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] } }> {
  log(`Analyzing batched response for ${criteria.length} criteria`);
  
  const analysisPrompt = `## Analysis Task

You are analyzing an agent's response to determine if multiple acceptance criteria have been satisfied.

**Criteria to analyze:**
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

**Agent's Response:**
${agentResponse}

**Working Directory:** ${sandboxCwd}

**Instructions:**
For EACH criterion, determine:
1. Check if the agent provided file paths for this criterion. If so, verify those files exist and contain relevant content.
2. Check if the agent provided a detailed explanation that demonstrates the criterion is satisfied.
3. Check if the agent explicitly stated the work is incomplete or not done for this criterion.
4. For design/planning tasks, check if documentation or design files exist.

**Output Format:**
Respond with a JSON object where each key is a criterion (exact text) and value is:
{
  "result": "COMPLETE" | "INCOMPLETE" | "UNCERTAIN",
  "reason": "Brief explanation",
  "file_paths": ["path1", "path2"] // if files were mentioned
}

Example:
{
  "POST /favorites/:listingId adds listing to favorites": {
    "result": "COMPLETE",
    "reason": "File src/modules/favorites/favorites.controller.ts contains the endpoint",
    "file_paths": ["src/modules/favorites/favorites.controller.ts"]
  },
  "DELETE /favorites/:listingId removes from favorites": {
    "result": "UNCERTAIN",
    "reason": "Response mentions endpoint but no file path provided",
    "file_paths": []
  }
}

Be strict but fair. Only mark COMPLETE if you can verify the work exists.`;

  const cursorResult = await cliAdapter.execute(analysisPrompt, sandboxCwd, agentMode || 'auto');
  const analysisOutput = cursorResult.stdout || cursorResult.rawOutput || '';

  try {
    const jsonMatch = analysisOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    log(`Failed to parse batched analysis JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Fallback: mark all as UNCERTAIN
  const fallback: { [criterion: string]: { result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] } } = {};
  for (const criterion of criteria) {
    fallback[criterion] = {
      result: 'UNCERTAIN',
      reason: 'Could not parse analysis response',
      file_paths: [],
    };
  }
  return fallback;
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
  maxQuestionsPerCriterion: number = 4,
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

    // Analyze response for all criteria
    const analysisResults = await analyzeBatchedResponse(
      unresolvedCriteria,
      agentResponse,
      sandboxCwd,
      cliAdapter,
      task.agent_mode
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
        log(`⚠️ Criterion "${criterion}" still ${analysis.result} after round ${questionNumber}`);
        stillUnresolved.push(criterion);
      }
    }

    log(`Round ${questionNumber} results: ${newlyResolved.length} resolved, ${stillUnresolved.length} still unresolved`);

    // Update unresolved criteria for next round
    unresolvedCriteria = stillUnresolved;

    // If all criteria resolved, stop early
    if (unresolvedCriteria.length === 0) {
      log(`✅ All criteria resolved after ${questionNumber} round(s)`);
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

/**
 * Analyze agent response using internal agent (Cursor CLI)
 * Determines if work is COMPLETE, INCOMPLETE, or UNCERTAIN
 */
async function analyzeAgentResponse(
  criterion: string,
  agentResponse: string,
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  agentMode?: string,
  filePathsFromResponse?: string[]
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

