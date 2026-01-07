// Prompt Builder - Deterministic prompt construction
// Prompts are data, not instructions
// No summarization, no paraphrasing, no creativity

import * as fs from 'fs';
import * as path from 'path';
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


const RULES_BLOCK = (agentMode: string): string[] => [
  '## Rules',
  '- Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT',
  '- Do NOT paraphrase, infer, or speculate beyond what is explicitly stated',
  '- If critical details (file paths, API signatures) are missing:',
  '  1. Check READ-ONLY CONTEXT (project structure, previous tasks) first',
  '  2. If still missing, STOP and ask ONE clarifying question',
  `- Remain in ${agentMode.toUpperCase()} MODE throughout execution`,
  '- Reference only files that exist in sandbox_root; verify before mentioning',
  '- Keep responses minimal: code changes + final JSON block only',
  '- Do NOT explain what you\'re about to do; just do it',
  ''
];

/**
 * Validate and filter file paths to only include files that exist in sandbox
 * Prevents hallucinated or absolute path references
 */
export function validateFilePaths(
  paths: string[],
  sandboxRoot: string
): string[] {
  return paths.filter(filePath => {
    // Remove absolute paths
    if (path.isAbsolute(filePath)) {
      logVerbose('ValidateFilePaths', 'Filtered absolute path', { filePath });
      return false;
    }
    
    // Remove paths starting with ~ or containing ../ (traversal attempts)
    if (filePath.startsWith('~') || filePath.includes('..')) {
      logVerbose('ValidateFilePaths', 'Filtered suspicious path', { filePath });
      return false;
    }
    
    // Check if file exists in sandbox
    const fullPath = path.join(sandboxRoot, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (!exists) {
      logVerbose('ValidateFilePaths', 'Filtered non-existent path', { filePath });
    }
    
    return exists;
  });
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
  const criteriaText = task.acceptance_criteria.join(' ').toLowerCase();
  const taskType = detectTaskType(task);

  // Track what we're including for debugging
  const included: string[] = ['project'];

  // Include goal only if relevant
  if (
    instructionsLower.includes('goal') ||
    intentLower.includes('goal') ||
    criteriaText.includes('goal') ||
    task.task_id.startsWith('goal-')
  ) {
    context.goal = {
      id: state.goal.project_id || 'default',
      description: state.goal.description,
    };
    included.push('goal');
  }

  // Include queue info only if temporal references exist
  if (
    instructionsLower.includes('previous') ||
    instructionsLower.includes('last task') ||
    instructionsLower.includes('earlier') ||
    instructionsLower.includes('after') ||
    instructionsLower.includes('before')
  ) {
    context.queue = {
      last_task_id: state.supervisor.last_task_id,
    };
    included.push('queue');
  }

  // Determine if we should include extended context or just recency bias
  const shouldExtend = 
    (instructionsLower.includes('extend') ||
    instructionsLower.includes('build on') ||
    instructionsLower.includes('previous implementation') ||
    instructionsLower.includes('based on') ||
    intentLower.includes('extend')) &&
    taskType !== 'documentation';

  if (shouldExtend) {
    // Include last 5 completed tasks for deep context
    context.completed_tasks = state.completed_tasks?.slice(-5).map(t => ({
      task_id: t.task_id,
      completed_at: t.completed_at,
    }));
    included.push(`completed_tasks(${context.completed_tasks?.length || 0})`);
  } else if (state.completed_tasks && state.completed_tasks.length > 0) {
    // Recency Bias: Always include the single most recent completed task
    // to maintain continuity even without explicit keywords
    context.completed_tasks = state.completed_tasks.slice(-1).map(t => ({
      task_id: t.task_id,
      completed_at: t.completed_at,
    }));
    included.push('completed_tasks(1-recency)');
  }

  // Include blocked tasks ONLY if task explicitly mentions unblocking
  if (
    instructionsLower.includes('unblock') ||
    instructionsLower.includes('blocked')
  ) {
    context.blocked_tasks = state.blocked_tasks?.map(t => ({
      task_id: t.task_id,
      reason: t.reason,
    }));
    included.push(`blocked_tasks(${context.blocked_tasks?.length || 0})`);
  }

  logVerbose('BuildMinimalState', 'Context built', {
    task_id: task.task_id,
    included_sections: included.join(', '),
    omitted_sections: ['goal', 'queue', 'completed_tasks', 'blocked_tasks']
      .filter(s => !included.includes(s) && !included.some(i => i.startsWith(s)))
      .join(', ') || 'none',
  });

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
  // Shared constraints for code-modifying tasks
  const sharedConstraints = [
    '- Ensure all exports/imports are typed',
    '- No conversational filler; code changes + JSON only'
  ];

  sections.push('## Guidelines');
  
  switch (taskType) {
    case 'implementation':
      sections.push('- Follow established project patterns');
      break;
    case 'configuration':
      sections.push('- Verify file locations; use fallback values');
      break;
    case 'testing':
      sections.push('- Descriptive assertions for edge cases');
      break;
    case 'documentation':
      sections.push('- Clear formatting; validate all links');
      break;
    case 'refactoring':
      sections.push('- Improve structure without changing behavior');
      break;
    case 'behavioral':
      sections.push('- Clear declarative response addressing all points');
      break;
  }

  // Add shared constraints only for code-modifying task types
  if (['implementation', 'refactoring', 'testing'].includes(taskType)) {
    sharedConstraints.forEach(constraint => sections.push(constraint));
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

  // NEW: Consolidated Rules
  const agentMode = task.agent_mode || 'auto';
  sections.push(...RULES_BLOCK(agentMode));

  // Task Type Guidelines
  const taskType = detectTaskType(task);
  addTaskTypeGuidelines(sections, taskType);

  // Section 5: Injected state snapshot (explicit section)
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');

  // Section 8: Explicit output format requirement
  sections.push('## Output Requirements');
  sections.push('Your response MUST end with ONLY this JSON block. Do NOT include prose before or after.');
  sections.push('');
  sections.push('If you made no file changes, use empty arrays: `"files_created": [], "files_updated": [], "changes": []`');
  sections.push('If you are unsure or cannot complete, set `"status": "failed"` and explain briefly in summary.');
  sections.push('');
  sections.push('```json');
  sections.push('{');
  sections.push('  "status": "completed" | "failed",');
  sections.push('  "files_created": ["relative/path/from/sandbox_root"],');
  sections.push('  "files_updated": ["relative/path/from/sandbox_root"],');
  sections.push('  "changes": ["relative/path/from/sandbox_root"],');
  sections.push('  "neededChanges": true | false,');
  sections.push('  "summary": "One sentence describing what was done or why it failed"');
  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push('Do not add any other fields. Use the exact keys provided. All file paths must be relative to sandbox_root.');
  sections.push('');

  // Section 9: Working directory
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');

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

  // Section 2: Validation feedback
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

  // Extract potential file paths from error messages to provide context
  const filePathsInErrors = new Set<string>();
  const pathRegex = /[\w\-./\\]+\.[a-zA-Z0-9]+/; 
  
  validationReport.rules_failed.forEach(rule => {
      const match = rule.match(pathRegex);
      if (match) filePathsInErrors.add(match[0]);
  });

  if (filePathsInErrors.size > 0) {
      sections.push('### Contextual File Content');
      filePathsInErrors.forEach(filePath => {
           // Basic validation to prevent path traversal reading
           if (path.isAbsolute(filePath) || filePath.includes('..')) return;
           
           const fullPath = path.join(minimalState.project.sandbox_root, filePath);
           if (fs.existsSync(fullPath)) {
               try {
                   const content = fs.readFileSync(fullPath, 'utf-8');
                   const lines = content.split('\n');
                   const preview = lines.slice(0, 50);
                   
                   sections.push(`File: ${filePath} (first ${preview.length} lines)`);
                   sections.push('```');
                   sections.push(preview.join('\n'));
                   if (lines.length > 50) sections.push('... (truncated)');
                   sections.push('```');
                   sections.push('');
               } catch (e) {
                   // Ignore read errors
               }
           }
      });
  }

  // Consolidated Rules
  const agentMode = task.agent_mode || 'auto';
  sections.push(...RULES_BLOCK(agentMode));
  
  // Specific Fix Guidelines
  sections.push('## Fix Instructions');
  sections.push('- Fix ONLY the issues in Validation Results; do not re-implement the entire task');
  sections.push('- Ensure ALL acceptance criteria are met');
  sections.push('');

  // NEW: Task Type Guidelines
  const taskType = detectTaskType(task);
  addTaskTypeGuidelines(sections, taskType);

  // Section 6: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
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
    sections.push('Previous response used ambiguous language (maybe, could, suggest, recommend, option).');
    sections.push('Provide definitive implementation using only declarative statements.');
  } else {
    sections.push('Previous response asked a question.');
    sections.push('Implement directly using only the information provided in the original task.');
  }
  sections.push('');

  // Consolidated Rules
  const agentMode = task.agent_mode || 'auto';
  sections.push(...RULES_BLOCK(agentMode));

  // Specific Clarification Guidelines
  sections.push('## Clarification Instructions');
  sections.push('- Implement definitively without ambiguous terms or questions');
  sections.push('- Use exact words: "will", "does", "creates", not "could", "might", "suggests"');
  sections.push('');

  // NEW: Task Type Guidelines
  const taskType = detectTaskType(task);
  addTaskTypeGuidelines(sections, taskType);

  // Section 5: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
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