// Audit Logger - Append-only, reviewable logs
// JSONL format, one event per line
// No mutation, no deletion

import { SupervisorState, Task, ValidationReport } from '../../../domain/types/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AuditLogPort } from '../../../domain/ports/auditLog';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AuditLogger] ${message}`, ...args);
}

export interface AuditLogEntry {
  timestamp: string; // ISO format
  iteration: number;
  event: string;
  task_id: string;
  tool_invoked: string; // Tool that was invoked (e.g., 'cursor')
  state_diff: {
    before: MinimalStateDiff;
    after: MinimalStateDiff;
  };
  validation_summary: {
    valid: boolean;
    rules_passed: string[];
    rules_failed: string[];
    reason?: string;
  };
  halt_reason?: string;
  prompt_preview?: string; // First 500 chars of prompt
  response_preview?: string; // First 500 chars of response
  prompt_length?: number;
  response_length?: number;
}

interface MinimalStateDiff {
  supervisor_status?: string;
  supervisor_iteration?: number;
  goal_completed?: boolean;
  queue_exhausted?: boolean;
  completed_tasks_count?: number;
}

/**
 * Create minimal state diff (only changed fields)
 */
function createMinimalStateDiff(state: SupervisorState): MinimalStateDiff {
  return {
    supervisor_status: state.supervisor.status,
    supervisor_iteration: state.supervisor.iteration,
    goal_completed: state.goal.completed,
    queue_exhausted: state.queue.exhausted,
    completed_tasks_count: state.completed_tasks?.length || 0,
  };
}

/**
 * Append audit log entry
 * JSONL format, one event per line
 * No mutation, no deletion
 */
export async function appendAuditLog(
  stateBefore: SupervisorState,
  stateAfter: SupervisorState,
  task: Task,
  validationReport: ValidationReport,
  sandboxRoot: string,
  projectId: string,
  prompt?: string,
  response?: string
): Promise<void> {
  // Determine log file path
  const logDir = path.join(sandboxRoot, projectId);
  const logPath = path.join(logDir, 'audit.log.jsonl');
  log(`Appending audit log for task ${task.task_id} to: ${logPath}`);

  // Create directory if it doesn't exist
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    log(`ERROR: Failed to create audit log directory: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to create audit log directory: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Create minimal state diffs
  const stateDiffBefore = createMinimalStateDiff(stateBefore);
  const stateDiffAfter = createMinimalStateDiff(stateAfter);

  // Determine event type
  let event = 'TASK_COMPLETED';
  if (stateAfter.supervisor.status === 'HALTED') {
    event = 'HALT';
  } else if (stateAfter.supervisor.status === 'COMPLETED') {
    event = 'GOAL_COMPLETED';
  }

  // Extract previews from prompt and response (first 500 chars)
  const promptPreview = prompt ? prompt.substring(0, 500) + (prompt.length > 500 ? '...' : '') : undefined;
  const responsePreview = response ? response.substring(0, 500) + (response.length > 500 ? '...' : '') : undefined;

  // Build audit log entry
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    iteration: stateAfter.supervisor.iteration || 0,
    event: event,
    task_id: task.task_id,
    tool_invoked: task.tool || 'unknown', // Log which tool was invoked
    state_diff: {
      before: stateDiffBefore,
      after: stateDiffAfter,
    },
    validation_summary: {
      valid: validationReport.valid,
      rules_passed: validationReport.rules_passed,
      rules_failed: validationReport.rules_failed,
      reason: validationReport.reason,
    },
    halt_reason: stateAfter.supervisor.halt_reason,
    prompt_preview: promptPreview,
    response_preview: responsePreview,
    prompt_length: prompt ? prompt.length : undefined,
    response_length: response ? response.length : undefined,
  };

  // Serialize to JSON line (JSONL format)
  const logLine = JSON.stringify(entry) + '\n';

  // Append to file (append-only, no mutation, no deletion)
  try {
    await fs.appendFile(logPath, logLine, 'utf8');
    log(`Audit log entry written for task ${task.task_id}, event: ${event}`);
  } catch (error) {
    log(`ERROR: Failed to append audit log: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to append audit log: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Legacy AuditLogger class for backward compatibility
export interface LegacyAuditLogEntry {
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

export class AuditLogger implements AuditLogPort {
  constructor(
    private logPath: string // Path to append-only log file
  ) {}

  /**
   * Implementation of AuditLogPort
   */
  async appendAuditLog(
    stateBefore: SupervisorState,
    stateAfter: SupervisorState,
    task: Task,
    validationReport: ValidationReport,
    sandboxRoot: string,
    projectId: string,
    prompt?: string,
    response?: string
  ): Promise<void> {
    return appendAuditLog(stateBefore, stateAfter, task, validationReport, sandboxRoot, projectId, prompt, response);
  }

  async append(entry: LegacyAuditLogEntry): Promise<void> {
    log(`Appending legacy audit log entry: ${entry.event}`);
    // Append-only logging
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      // Ensure directory exists
      const logDir = path.dirname(this.logPath);
      await fs.mkdir(logDir, { recursive: true });
      
      // Append to file
      await fs.appendFile(this.logPath, logLine, 'utf8');
      log(`Legacy audit log entry written: ${entry.event}`);
    } catch (error) {
      log(`ERROR: Failed to append legacy audit log: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to append audit log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
