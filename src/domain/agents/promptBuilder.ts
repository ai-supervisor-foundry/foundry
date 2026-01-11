// Prompt Builder - Deterministic prompt construction
// Prompts are data, not instructions
// No summarization, no paraphrasing, no creativity

import * as fs from 'fs';
import * as path from 'path';
import { Task, SupervisorState, TaskType } from '../types/types';
import { logVerbose, logPerformance } from '../../infrastructure/adapters/logging/logger';

// Constants for Markdown generation to avoid nested backtick syntax errors in TS
const MD_JSON_START = "```json";
const MD_CODE_END = "```";

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
  recent_completed_tasks?: Array<{
    task_id: string;
    completed_at: string;
    intent: string;
    success: boolean;
  }>;
  active_blockers?: Array<{
    task_id: string;
    reason: string;
    blocked_at: string;
  }>;
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

  // ALWAYS: Include last 3-5 completed tasks (working memory)
  if (state.completed_tasks && state.completed_tasks.length > 0) {
    const recentTasks = state.completed_tasks.slice(-5);
    context.recent_completed_tasks = recentTasks.map(t => ({
      task_id: t.task_id,
      completed_at: t.completed_at,
      intent: t.intent || `[Unknown] ${t.task_id}`,
      success: t.validation_report.valid,
    }));
  }

  // ALWAYS: Include active blockers (critical awareness)
  if (state.blocked_tasks && state.blocked_tasks.length > 0) {
    context.active_blockers = state.blocked_tasks.map(t => ({
      task_id: t.task_id,
      reason: t.reason,
      blocked_at: t.blocked_at,
    }));
  }

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

/**
 * Detect task type based on intent and instructions, or return explicit type if set
 */
export function detectTaskType(task: Task): TaskType {
  // If task has an explicit type (and it's not the default 'coding' if no specific intent matches), favor it.
  if (task.task_type && task.task_type !== 'coding') {
    return task.task_type;
  }

  const lowerInstructions = task.instructions.toLowerCase();
  const lowerIntent = task.intent.toLowerCase();
  
  // Explicit type overrides heuristics
  if (task.task_type) return task.task_type;

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

  // Verification detection
  if (lowerInstructions.match(/\b(verify|check|audit|analyze|confirm)\b/) || 
      lowerIntent.match(/\b(verify|check|audit|analyze|confirm)\b/)) {
    return 'verification';
  }

  return 'coding'; // Default fallback
}

// --- Strategy Pattern for Prompt Construction ---

interface TaskStrategy {
  getRules(agentMode: string): string[];
  getGuidelines(): string[];
  getOutputRequirements(): string[];
}

const CODING_STRATEGY: TaskStrategy = {
  getRules: (agentMode: string) => [
    '## Rules',
    '- Check READ-ONLY CONTEXT (project structure, previous tasks) first',
    '- Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT',
    '- Do NOT paraphrase, infer, or speculate beyond what is explicitly stated',
    `- Remain in ${agentMode.toUpperCase()} MODE throughout execution`,
    '- Reference only files that exist in sandbox_root; verify before mentioning',
    '- Keep responses minimal: code changes + final JSON block only',
    '- Do NOT explain what you\'re about to do; just do it',
    '- STOP and ask ONE clarifying question if the task is ambiguous',
    ''
  ],
  getGuidelines: () => [
    '## Guidelines',
    '- Ensure all exports/imports are typed',
    '- No conversational filler; code changes + JSON only',
    '- Follow established project patterns',
    '- Cover edge cases',
    ''
  ],
  getOutputRequirements: () => [
    `## Output Requirements
Your response MUST end with ONLY this JSON block. Do NOT include prose before or after.

If you made no file changes, use empty arrays: "files_created": [], "files_updated": [], "changes": []
If you are unsure or cannot complete, set "status": "failed" and explain briefly in summary.

${MD_JSON_START}
{
  "status": "completed" | "failed",
  "files_created": ["relative/path/from/sandbox_root"],
  "files_updated": ["relative/path/from/sandbox_root"],
  "changes": ["relative/path/from/sandbox_root"],
  "neededChanges": true | false,
  "reasoning": "Briefly explain your technical approach or why it failed",
  "summary": "One sentence describing what was done or why it failed"
}
${MD_CODE_END}

Do not add any other fields. Use the exact keys provided. All file paths must be relative to sandbox_root.
`
  ]
};

const BEHAVIORAL_STRATEGY: TaskStrategy = {
  getRules: (agentMode: string) => [
    '## Rules',
    '- Answer the user\'s question directly and clearly',
    '- Use information from the READ-ONLY CONTEXT to inform your answer',
    `- Remain in ${agentMode.toUpperCase()} MODE`,
    '- Do NOT invent file paths or code if not asked',
    '- Provide a clear "reasoning" for your answer',
    ''
  ],
  getGuidelines: () => [
    '## Guidelines',
    '- Clear declarative response addressing all points',
    '- Be helpful but concise',
    '- If the request is a greeting, respond naturally',
    ''
  ],
  getOutputRequirements: () => [
    `## Output Requirements
Your response MUST end with ONLY this JSON block. Do NOT include prose before or after.

${MD_JSON_START}
{
  "status": "completed" | "failed",
  "response": "Your actual text response to the user here",
  "confidence": 0.0-1.0,
  "reasoning": "Explain why you gave this answer"
}
${MD_CODE_END}

Do not add any other fields. Use the exact keys provided.
`
  ]
};

const VERIFICATION_STRATEGY: TaskStrategy = {
  getRules: (agentMode: string) => [
    '## Rules',
    '- Read actual files using `cat` or `grep` to verify criteria',
    '- Do NOT modify any files (Read-Only)',
    '- Report specific findings with file paths',
    '- Mark findings as "pass" or "fail"',
    `- Remain in ${agentMode.toUpperCase()} MODE`,
    ''
  ],
  getGuidelines: () => [
    '## Guidelines',
    '- Be rigorous in your verification',
    '- Provide evidence (file paths, line numbers) for every finding',
    '- If a criterion is ambiguous, explain why',
    ''
  ],
  getOutputRequirements: () => [
    `## Output Requirements
Your response MUST end with ONLY this JSON block. Do NOT include prose before or after.

${MD_JSON_START}
{
  "status": "completed" | "failed",
  "findings": ["Finding 1: ...", "Finding 2: ..."],
  "verdict": "pass" | "fail",
  "reasoning": "Evidence-based conclusion"
}
${MD_CODE_END}

Do not add any other fields. Use the exact keys provided.
`
  ]
};

const TESTING_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getGuidelines: () => [
    ...CODING_STRATEGY.getGuidelines(),
    '- Descriptive assertions for edge cases',
    '- Verify specific failure conditions',
    '- Ensure test isolation',
    ''
  ]
};

const CONFIGURATION_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getGuidelines: () => [
    ...CODING_STRATEGY.getGuidelines(),
    '- Verify file locations; use fallback values',
    '- Use environment variables for secrets',
    '- Validate configuration schema',
    ''
  ]
};

const DOCUMENTATION_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getGuidelines: () => [
    ...CODING_STRATEGY.getGuidelines(),
    '- Clear formatting; validate all links',
    '- Include code examples where appropriate',
    '- Keep documentation up-to-date with code',
    ''
  ]
};

const REFACTORING_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getGuidelines: () => [
    ...CODING_STRATEGY.getGuidelines(),
    '- Improve structure without changing behavior',
    '- Ensure existing tests pass',
    '- Keep changes atomic and focused',
    ''
  ]
};

function getStrategy(taskType: TaskType): TaskStrategy {
  switch (taskType) {
    case 'behavioral':
      return BEHAVIORAL_STRATEGY;
    case 'verification':
      return VERIFICATION_STRATEGY;
    case 'testing':
      return TESTING_STRATEGY;
    case 'configuration':
      return CONFIGURATION_STRATEGY;
    case 'documentation':
      return DOCUMENTATION_STRATEGY;
    case 'refactoring':
      return REFACTORING_STRATEGY;
    case 'coding':
    case 'implementation':
    default:
      return CODING_STRATEGY;
  }
}

/**
 * Deterministic prompt construction
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
  const taskType = detectTaskType(task);
  const strategy = getStrategy(taskType);
  const agentMode = task.agent_mode || 'auto';

  // Section 1: Task ID
  sections.push('## Task ID');
  sections.push(task.task_id);
  sections.push('');

  // Section 2: Task description
  sections.push('## Task Description');
  sections.push(task.instructions);
  sections.push('');

  // Section 3: Intent
  sections.push('## Intent');
  sections.push(task.intent);
  sections.push('');

  // Section 4: Acceptance criteria
  sections.push('## Acceptance Criteria');
  for (const criterion of task.acceptance_criteria) {
    sections.push(`- ${criterion}`);
  }
  sections.push('');

  // Strategy-based Rules
  sections.push(...strategy.getRules(agentMode));

  // Strategy-based Guidelines
  sections.push(...strategy.getGuidelines());

  // Section 5: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');

  // Section 8: Output Requirements
  sections.push(...strategy.getOutputRequirements());

  // Section 9: Working directory
  sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
  sections.push('');

  const prompt = sections.join('\n');
  const duration = Date.now() - startTime;
  logPerformance('BuildPrompt', duration, {
    task_id: task.task_id,
    prompt_length: prompt.length,
    sections_count: sections.length,
    task_type: taskType
  });
  logVerbose('BuildPrompt', 'Prompt built successfully', {
    task_id: task.task_id,
    prompt_length: prompt.length,
    sections_count: sections.length,
    task_type: taskType,
    prompt_preview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
  });
  return prompt;
}

/**
 * Build a fix prompt with validation feedback
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
  const taskType = detectTaskType(task);
  const strategy = getStrategy(taskType);
  const agentMode = task.agent_mode || 'auto';

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

  // Extract potential file paths from error messages
  const filePathsInErrors = new Set<string>();
  const pathRegex = /[\w\-.\/\\]+\.[a-zA-Z0-9]+/; 
  
  validationReport.rules_failed.forEach(rule => {
      const match = rule.match(pathRegex);
      if (match) filePathsInErrors.add(match[0]);
  });

  if (filePathsInErrors.size > 0) {
      sections.push('### Contextual File Content');
      filePathsInErrors.forEach(filePath => {
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

  // Strategy-based Rules
  sections.push(...strategy.getRules(agentMode));
  
  // Specific Fix Guidelines
  sections.push('## Fix Instructions');
  sections.push('- Fix ONLY the issues in Validation Results; do not re-implement the entire task');
  sections.push('- Ensure ALL acceptance criteria are met');
  sections.push('');

  // Strategy Guidelines
  sections.push(...strategy.getGuidelines());

  // Section 6: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');
  
  // Output Requirements reminder
  sections.push(...strategy.getOutputRequirements());

  const prompt = sections.join('\n');
  const duration = Date.now() - startTime;
  logPerformance('BuildFixPrompt', duration, {
    task_id: task.task_id,
    prompt_length: prompt.length,
  });
  return prompt;
}

/**
 * Build a clarification prompt
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
  const taskType = detectTaskType(task);
  const strategy = getStrategy(taskType);
  const agentMode = task.agent_mode || 'auto';

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

  // Strategy-based Rules
  sections.push(...strategy.getRules(agentMode));

  // Specific Clarification Guidelines
  sections.push('## Clarification Instructions');
  sections.push('- Implement definitively without ambiguous terms or questions');
  sections.push('- Use exact words: "will", "does", "creates", not "could", "might", "suggests"');
  sections.push('');

  // Strategy Guidelines
  sections.push(...strategy.getGuidelines());

  // Section 5: Context
  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));
  sections.push('');
  
  // Output Requirements reminder
  sections.push(...strategy.getOutputRequirements());

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
  sections.push(MD_JSON_START);
  sections.push('{');
  sections.push('  "goal_completed": true or false,');
  sections.push('  "reasoning": "Brief explanation of your assessment"');
  sections.push('}');
  sections.push(MD_CODE_END);
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