// Prompt Builder - Deterministic prompt construction
// Prompts are data, not instructions
// No summarization, no paraphrasing, no creativity

import { Task } from './types';
import { logVerbose, logPerformance } from './logger';

export interface MinimalState {
  project: {
    id: string;
    sandbox_root: string;
  };
  goal: {
    id: string;
    description: string;
  };
  queue: {
    last_task_id?: string;
  };
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
  
  // Build prompt following exact structure from TOOL_CONTRACTS.md
  // No summarization, no paraphrasing, verbatim only

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
  sections.push('- Output format: Provide task completion status and validation results');
  sections.push('- IMPORTANT: Inform which files were created or updated (this is used for validation)');
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

// Legacy PromptBuilder class for backward compatibility
export class PromptBuilder {
  buildMinimalSnapshot(state: any, _task: Task): MinimalState {
    return {
      project: {
        id: state.goal.project_id || 'default',
        sandbox_root: state.project?.sandbox_root || '/sandbox/default',
      },
      goal: {
        id: state.goal.id || 'default',
        description: state.goal.description,
      },
      queue: {
        last_task_id: state.queue?.last_task_id,
      },
    };
  }

  buildTaskPrompt(task: Task, stateSnapshot: MinimalState): string {
    return buildPrompt(task, stateSnapshot);
  }
}
