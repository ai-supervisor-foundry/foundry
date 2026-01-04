// Prompt Builder - Deterministic prompt construction
// Prompts are data, not instructions
// No summarization, no paraphrasing, no creativity

import { Task, SupervisorState } from '../types/types';
import { logVerbose, logPerformance } from '../../infrastructure/adapters/logging/logger';

export interface MinimalState {
  project: {
    id: string;
    sandbox_root: string;
  };
  goal?: {
    id: string;
    description: string;
  };
  queue?: {
    last_task_id?: string;
  };
  completed_tasks?: Array<{
    task_id: string;
    completed_at: string;
  }>;
  blocked_tasks?: Array<{
    task_id: string;
    reason: string;
  }>;
}

/**
 * Build task-aware minimal state context
 * Reduces prompt size by including only relevant context
 */
export function buildMinimalState(task: Task, state: SupervisorState, sandboxCwd: string): MinimalState {
  const context: MinimalState = {
    project: {
      id: state.goal.project_id || 'default',
      sandbox_root: sandboxCwd,
    },
  };

  const instructionsLower = task.instructions.toLowerCase();
  const intentLower = task.intent.toLowerCase();

  // Include goal only if relevant
  if (
    instructionsLower.includes('goal') ||
    intentLower.includes('goal') ||
    task.task_id.startsWith('goal-')
  ) {
    context.goal = {
      id: state.goal.project_id || 'default',
      description: state.goal.description,
    };
  }

  // Include queue info only if relevant
  if (
    instructionsLower.includes('previous') ||
    instructionsLower.includes('last task') ||
    instructionsLower.includes('earlier')
  ) {
    context.queue = {
      last_task_id: state.supervisor.last_task_id,
    };
  }

  // Include completed tasks only if relevant
  if (
    instructionsLower.includes('extend') ||
    instructionsLower.includes('build on') ||
    instructionsLower.includes('previous implementation') ||
    intentLower.includes('extend')
  ) {
    // Include last 5 completed tasks
    context.completed_tasks = state.completed_tasks?.slice(-5).map(t => ({
      task_id: t.task_id,
      completed_at: t.completed_at,
    }));
  }

  // Include blocked tasks if task might unblock something
  if (instructionsLower.includes('unblock')) {
    context.blocked_tasks = state.blocked_tasks?.map(t => ({
      task_id: t.task_id,
      reason: t.reason,
    }));
  }

  return context;
}

type TaskType = 'implementation' | 'configuration' | 'testing' | 'documentation' | 'refactoring' | 'behavioral';

/**
 * Detect task type based on intent and instructions
 */
function detectTaskType(task: Task): TaskType {
  const lowerInstructions = task.instructions.toLowerCase();
  const lowerIntent = task.intent.toLowerCase();
  
  if (lowerInstructions.includes('test') || lowerIntent.includes('test')) {
    return 'testing';
  }
  if (lowerInstructions.includes('config') || lowerInstructions.includes('setup') || lowerInstructions.includes('env')) {
    return 'configuration';
  }
  if (lowerInstructions.includes('document') || lowerInstructions.includes('readme') || lowerInstructions.includes('guide')) {
    return 'documentation';
  }
  if (lowerInstructions.includes('refactor') || lowerInstructions.includes('improve') || lowerInstructions.includes('clean')) {
    return 'refactoring';
  }
  
  // Behavioral detection
  if (lowerInstructions.match(/\b(greet|hello|say|respond|explain|who are you)\b/) || 
      lowerIntent.match(/\b(greet|hello|say|respond|explain|who are you)\b/)) {
    return 'behavioral';
  }

  return 'implementation';
}

/**
 * Add task-type-specific guidelines to the prompt
 */
function addTaskTypeGuidelines(sections: string[], taskType: TaskType): void {
  sections.push('## Guidelines');
  
  switch (taskType) {
    case 'implementation':
      sections.push('- Focus on clean code structure and established patterns.');
      sections.push('- Ensure all new components/functions are exported and typed correctly.');
      sections.push('- Be concise. If JSON output is requested, provide ONLY the JSON without conversational filler.');
      break;
    case 'configuration':
      sections.push('- Verify configuration file locations and environment variable names.');
      sections.push('- Ensure fallback values are provided where appropriate.');
      break;
    case 'testing':
      sections.push('- Focus on edge cases and error conditions.');
      sections.push('- Ensure assertions are descriptive and meaningful.');
      break;
    case 'documentation':
      sections.push('- Ensure clear formatting and consistent terminology.');
      sections.push('- Verify that all links and references are valid.');
      break;
    case 'refactoring':
      sections.push('- Preserve existing functionality while improving structure.');
      sections.push('- Verify that no breaking changes are introduced to public APIs.');
      sections.push('- Be concise. If JSON output is requested, provide ONLY the JSON without conversational filler.');
      break;
    case 'behavioral':
      sections.push('- Provide a clear and natural conversational response.');
      sections.push('- Address all parts of the user request directly.');
      break;
  }
  sections.push('');
}

/**
 * Deterministic prompt construction
 * Follows PROMPT.md and TOOL_CONTRACTS.md exactly
 * Preserves ordering and wording
 * Injects fields verbatim
 */
export function buildPrompt(task: Task, minimalState: MinimalState): string {
  const startTime = Date.now();
  logVerbose('BuildPrompt', 'Building prompt', {
    task_id: task.task_id,
    intent: task.intent,
    acceptance_criteria_count: task.acceptance_criteria?.length || 0,
    project_id: minimalState.project.id,
  });
  
  const sections: string[] = [];

  // Section 1: Task ID (verbatim)
  sections.push('## Task ID');
  sections.push(task.task_id);
  sections.push('');

  // Section 2: Task description (verbatim from operator)
  sections.push('## Task Description');
  sections.push(task.instructions);
  sections.push('');

  // Section 3: Intent (verbatim)
  sections.push('## Intent');
  sections.push(task.intent);
  sections.push('');

  // Section 4: Acceptance criteria (verbatim)
  sections.push('## Acceptance Criteria');
  for (const criterion of task.acceptance_criteria) {
    sections.push(`- ${criterion}`);
  }
  sections.push('');

  // NEW: Task Type Guidelines
  const taskType = detectTaskType(task);
  addTaskTypeGuidelines(sections, taskType);

  // Section 5: Injected state snapshot (explicit section)
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');

  // Section 6: Explicit instruction to remain in specified agent mode
  const agentMode = task.agent_mode || 'auto';
  sections.push('## Instructions');
  sections.push(`- Remain in ${agentMode.toUpperCase()} MODE`);
  sections.push('');

  // Section 7: Explicit instruction to halt on ambiguity
  sections.push('- Halt on ambiguity - do not infer missing information');
  sections.push('');

  // Section 8: Explicit output format requirement
  sections.push('## Output Requirements');
  sections.push('You MUST end your response with a JSON summary block in this exact format:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "status": "completed" | "failed",');
  sections.push('  "files_created": ["path/to/file"],');
  sections.push('  "files_updated": ["path/to/file"],');
  sections.push('  "summary": "Brief description of work done"');
  sections.push('}');
  sections.push('```');
  sections.push('');

  // Section 9: Working directory
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');

  // Section 10: Final instruction (verbatim from TOOL_CONTRACTS.md)
  sections.push('If any implementation decision is not explicitly specified above or in the refresher, STOP and ask for operator clarification. Do not assume.');

  const prompt = sections.join('\n');
  const duration = Date.now() - startTime;
  logPerformance('BuildPrompt', duration, {
    task_id: task.task_id,
    prompt_length: prompt.length,
    sections_count: sections.length,
  });
  logVerbose('BuildPrompt', 'Prompt built successfully', {
    task_id: task.task_id,
    prompt_length: prompt.length,
    sections_count: sections.length,
    prompt_preview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
  });
  return prompt;
}

/**
 * Build a fix prompt with validation feedback
 * Used when validation fails to guide the agent to fix issues
 */
export function buildFixPrompt(
  task: Task,
  minimalState: MinimalState,
  validationReport: { reason?: string; rules_failed: string[]; rules_passed: string[] }
): string {
  const startTime = Date.now();
  logVerbose('BuildFixPrompt', 'Building fix prompt', {
    task_id: task.task_id,
    validation_reason: validationReport.reason,
    rules_failed_count: validationReport.rules_failed.length,
    rules_passed_count: validationReport.rules_passed.length,
  });
  
  const sections: string[] = [];

  // Section 1: Task ID
  sections.push('## Task ID');
  sections.push(task.task_id);
  sections.push('');

  // Section 2: Fix instruction
  sections.push('## Fix Required');
  sections.push('The previous attempt did not meet all acceptance criteria. Please fix the following issues:');
  sections.push('');

  // Section 3: Validation feedback
  sections.push('## Validation Results');
  if (validationReport.reason) {
    sections.push(`Reason: ${validationReport.reason}`);
  }
  if (validationReport.rules_failed.length > 0) {
    sections.push('Failed validations:');
    for (const rule of validationReport.rules_failed) {
      sections.push(`- ${rule}`);
    }
  }
  if (validationReport.rules_passed.length > 0) {
    sections.push('Passed validations:');
    for (const rule of validationReport.rules_passed) {
      sections.push(`- ${rule}`);
    }
  }
  sections.push('');

  // Section 4: Original task description
  sections.push('## Original Task Description');
  sections.push(task.instructions);
  sections.push('');

  // Section 5: Acceptance criteria (reminder)
  sections.push('## Acceptance Criteria (Must All Be Met)');
  for (const criterion of task.acceptance_criteria) {
    sections.push(`- ${criterion}`);
  }
  sections.push('');

  // NEW: Task Type Guidelines
  const taskType = detectTaskType(task);
  addTaskTypeGuidelines(sections, taskType);

  // Section 6: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');

  // Section 7: Instructions
  const agentMode = task.agent_mode || 'auto';
  sections.push('## Instructions');
  sections.push('- Fix the issues identified in Validation Results');
  sections.push('- Ensure ALL acceptance criteria are met');
  sections.push(`- Remain in ${agentMode.toUpperCase()} MODE`);
  sections.push('- Do not infer missing information - use only what is specified');
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');

  const prompt = sections.join('\n');
  const duration = Date.now() - startTime;
  logPerformance('BuildFixPrompt', duration, {
    task_id: task.task_id,
    prompt_length: prompt.length,
  });
  return prompt;
}

/**
 * Build a clarification prompt for ambiguity or questions
 * Used when AMBIGUITY or ASKED_QUESTION detected but validation might still pass
 */
export function buildClarificationPrompt(
  task: Task,
  minimalState: MinimalState,
  haltReason: 'AMBIGUITY' | 'ASKED_QUESTION'
): string {
  const startTime = Date.now();
  logVerbose('BuildClarificationPrompt', 'Building clarification prompt', {
    task_id: task.task_id,
    halt_reason: haltReason,
  });
  
  const sections: string[] = [];

  // Section 1: Task ID
  sections.push('## Task ID');
  sections.push(task.task_id);
  sections.push('');

  // Section 2: Clarification instruction
  sections.push('## Clarification Required');
  if (haltReason === 'AMBIGUITY') {
    sections.push('Your previous response contained ambiguous language (maybe, could, suggest, recommend, alternative, option).');
    sections.push('Please provide a definitive implementation without ambiguous terms.');
  } else {
    sections.push('Your previous response contained a question mark.');
    sections.push('Please provide a definitive implementation without asking questions.');
  }
  sections.push('');

  // Section 3: Original task description
  sections.push('## Original Task Description');
  sections.push(task.instructions);
  sections.push('');

  // Section 4: Acceptance criteria (reminder)
  sections.push('## Acceptance Criteria (Must All Be Met)');
  for (const criterion of task.acceptance_criteria) {
    sections.push(`- ${criterion}`);
  }
  sections.push('');

  // NEW: Task Type Guidelines
  const taskType = detectTaskType(task);
  addTaskTypeGuidelines(sections, taskType);

  // Section 5: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');

  // Section 6: Instructions
  const agentMode = task.agent_mode || 'auto';
  sections.push('## Instructions');
  sections.push('- Provide a definitive, unambiguous implementation');
  sections.push('- Do not use words like: maybe, could, suggest, recommend, alternative, option');
  sections.push('- Do not ask questions - implement directly');
  sections.push('- Ensure ALL acceptance criteria are met');
  sections.push(`- Remain in ${agentMode.toUpperCase()} MODE`);
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');

  const prompt = sections.join('\n');
  const duration = Date.now() - startTime;
  logPerformance('BuildClarificationPrompt', duration, {
    task_id: task.task_id,
    halt_reason: haltReason,
    prompt_length: prompt.length,
  });
  logVerbose('BuildClarificationPrompt', 'Clarification prompt built successfully', {
    task_id: task.task_id,
    halt_reason: haltReason,
    prompt_length: prompt.length,
  });
  return prompt;
}


/**
 * Build prompt to ask agent if goal is completed
 */
export function buildGoalCompletionPrompt(state: SupervisorState, sandboxRoot: string): string {
  const sections: string[] = [];
  
  sections.push('## Goal Completion Check');
  sections.push('');
  sections.push('You are being asked to evaluate if the project goal has been completed.');
  sections.push('');
  sections.push('## Goal Description');
  sections.push(state.goal.description);
  sections.push('');
  sections.push('## Completed Tasks');
  if (state.completed_tasks && state.completed_tasks.length > 0) {
    sections.push(`Total completed: ${state.completed_tasks.length}`);
    sections.push('');
    sections.push('Recent completed tasks:');
    state.completed_tasks.slice(-10).forEach((task) => {
      sections.push(`- ${task.task_id} (completed at ${task.completed_at})`);
    });
  } else {
    sections.push('No tasks completed yet.');
  }
  sections.push('');
  sections.push('## Blocked Tasks');
  if (state.blocked_tasks && state.blocked_tasks.length > 0) {
    sections.push(`Total blocked: ${state.blocked_tasks.length}`);
    sections.push('');
    state.blocked_tasks.forEach((task) => {
      sections.push(`- ${task.task_id} (blocked: ${task.reason})`);
    });
  } else {
    sections.push('No blocked tasks.');
  }
  sections.push('');
  sections.push('## Project Structure');
  sections.push(`Frontend: ${sandboxRoot}/easeclassifieds`);
  sections.push(`Backend: ${sandboxRoot}/easeclassifieds-api`);
  sections.push('');
  sections.push('## Your Task');
  sections.push('Analyze the goal description and the completed tasks.');
  sections.push('Determine if the goal has been fully achieved based on:');
  sections.push('1. All major features mentioned in the goal are implemented');
  sections.push('2. The system is functional and complete');
  sections.push('3. No critical components are missing');
  sections.push('');
  sections.push('## Output Format');
  sections.push('Respond with JSON in this exact format:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "goal_completed": true or false,');
  sections.push('  "reasoning": "Brief explanation of your assessment"');
  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push('Be honest and thorough in your assessment.');
  
  return sections.join('\n');
}

/**
 * Parse agent response to determine if goal is completed
 */
export function parseGoalCompletionResponse(response: string): boolean {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.goal_completed === 'boolean') {
        return parsed.goal_completed;
      }
    }
    
    // Fallback: check for positive/negative indicators in text
    const responseLower = response.toLowerCase();
    if (responseLower.includes('goal_completed') && responseLower.includes('true')) {
      return true;
    }
    if (responseLower.includes('goal_completed') && responseLower.includes('false')) {
      return false;
    }
    if (responseLower.includes('yes') && (responseLower.includes('complete') || responseLower.includes('achieved'))) {
      return true;
    }
    if (responseLower.includes('no') && (responseLower.includes('complete') || responseLower.includes('achieved'))) {
      return false;
    }
    
    // Default to false if unclear
    return false;
  } catch (error) {
    logVerbose('ParseGoalCompletion', 'Failed to parse goal completion response', {
      error: error instanceof Error ? error.message : String(error),
      response_preview: response.substring(0, 200),
    });
    return false;
  }
}

// Legacy PromptBuilder class for backward compatibility
export class PromptBuilder {
  buildMinimalSnapshot(state: SupervisorState, task: Task, sandboxCwd?: string): MinimalState {
    const defaultCwd = state.goal.project_id ? `sandbox/${state.goal.project_id}` : 'sandbox/default';
    return buildMinimalState(task, state, sandboxCwd || defaultCwd);
  }

  buildTaskPrompt(task: Task, stateSnapshot: MinimalState): string {
    return buildPrompt(task, stateSnapshot);
  }
}
