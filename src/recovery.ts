// Recovery Detection and Handling
// Implements RECOVERY.md scenarios

import { SupervisorState, Task } from './types';
import { CursorResult } from './haltDetection';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from './logger';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`Recovery:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[Recovery] ${operation}`, duration, metadata);
}

export type RecoveryScenario =
  | 'CURSOR_CRASH'
  | 'PARTIAL_TASK'
  | 'CONFLICTING_STATE'
  | 'NONE';

export interface RecoveryDetection {
  scenario: RecoveryScenario;
  details?: string;
}

/**
 * Detect recovery scenarios based on state and task execution
 */
export function detectRecoveryScenario(
  state: SupervisorState,
  lastTask: Task | null,
  cursorResult: CursorResult | null
): RecoveryDetection {
  const startTime = Date.now();
  logVerbose('DetectRecoveryScenario', 'Detecting recovery scenarios', {
    status: state.supervisor.status,
    has_last_task: !!lastTask,
    last_task_id: lastTask?.task_id,
    has_cursor_result: !!cursorResult,
    cursor_exit_code: cursorResult?.exitCode,
  });
  
  // Scenario 1: Cursor CLI crash
  // Detected by: non-zero exit code, no output, or process error
  if (cursorResult) {
    if (cursorResult.exitCode !== 0 && cursorResult.rawOutput.trim().length === 0) {
      const duration = Date.now() - startTime;
      logPerformance('DetectRecoveryScenario', duration, { scenario: 'CURSOR_CRASH' });
      logVerbose('DetectRecoveryScenario', 'CURSOR_CRASH detected', {
        exit_code: cursorResult.exitCode,
        output_length: cursorResult.rawOutput.length,
      });
      return {
        scenario: 'CURSOR_CRASH',
        details: `Cursor CLI exited with code ${cursorResult.exitCode} and produced no output`,
      };
    }
    
    // If exit code is non-zero and we have a last task, might be a crash
    if (cursorResult.exitCode !== 0 && lastTask && state.supervisor.last_task_id === lastTask.task_id) {
      const duration = Date.now() - startTime;
      logPerformance('DetectRecoveryScenario', duration, { scenario: 'CURSOR_CRASH' });
      logVerbose('DetectRecoveryScenario', 'CURSOR_CRASH detected (task execution failure)', {
        exit_code: cursorResult.exitCode,
        task_id: lastTask.task_id,
      });
      return {
        scenario: 'CURSOR_CRASH',
        details: `Cursor CLI failed during task ${lastTask.task_id} execution`,
      };
    }
  }

  // Scenario 2: Partial task
  // Detected by: task in progress but no completion, or validation partially passed
  if (lastTask && state.supervisor.last_task_id === lastTask.task_id) {
    const validationReport = state.supervisor.last_validation_report;
    if (validationReport && !validationReport.valid) {
      // Check if some rules passed but not all (partial completion)
      if (validationReport.rules_passed.length > 0 && validationReport.rules_failed.length > 0) {
        const duration = Date.now() - startTime;
        logPerformance('DetectRecoveryScenario', duration, { scenario: 'PARTIAL_TASK' });
        logVerbose('DetectRecoveryScenario', 'PARTIAL_TASK detected (partial validation)', {
          task_id: lastTask.task_id,
          rules_passed_count: validationReport.rules_passed.length,
          rules_failed_count: validationReport.rules_failed.length,
        });
        return {
          scenario: 'PARTIAL_TASK',
          details: `Task ${lastTask.task_id} partially completed: ${validationReport.rules_passed.length} rules passed, ${validationReport.rules_failed.length} failed`,
        };
      }
    }
    
    // Task marked as in_progress but no completion
    if (lastTask.status === 'in_progress' && !state.completed_tasks?.some(t => t.task_id === lastTask.task_id)) {
      const duration = Date.now() - startTime;
      logPerformance('DetectRecoveryScenario', duration, { scenario: 'PARTIAL_TASK' });
      logVerbose('DetectRecoveryScenario', 'PARTIAL_TASK detected (in progress but not completed)', {
        task_id: lastTask.task_id,
        status: lastTask.status,
      });
      return {
        scenario: 'PARTIAL_TASK',
        details: `Task ${lastTask.task_id} was in progress but never completed`,
      };
    }
  }

  // Scenario 3: Conflicting state
  // Detected by: inconsistent state (e.g., RUNNING but no current task, or multiple conflicting flags)
  if (state.supervisor.status === 'RUNNING' && !state.current_task && state.queue.exhausted && !state.goal.completed) {
    const duration = Date.now() - startTime;
    logPerformance('DetectRecoveryScenario', duration, { scenario: 'CONFLICTING_STATE' });
    logVerbose('DetectRecoveryScenario', 'CONFLICTING_STATE detected (RUNNING but exhausted)', {
      status: state.supervisor.status,
      has_current_task: !!state.current_task,
      queue_exhausted: state.queue.exhausted,
      goal_completed: state.goal.completed,
    });
    return {
      scenario: 'CONFLICTING_STATE',
      details: 'Supervisor is RUNNING but queue is exhausted and goal is incomplete with no current task',
    };
  }

  // Check for conflicting status indicators
  if (state.supervisor.halt_reason && state.supervisor.status !== 'HALTED') {
    const duration = Date.now() - startTime;
    logPerformance('DetectRecoveryScenario', duration, { scenario: 'CONFLICTING_STATE' });
    logVerbose('DetectRecoveryScenario', 'CONFLICTING_STATE detected (halt_reason but not HALTED)', {
      status: state.supervisor.status,
      halt_reason: state.supervisor.halt_reason,
    });
    return {
      scenario: 'CONFLICTING_STATE',
      details: `State has halt_reason but status is ${state.supervisor.status}, not HALTED`,
    };
  }

  // No recovery scenario detected
  const duration = Date.now() - startTime;
  logPerformance('DetectRecoveryScenario', duration, { scenario: 'NONE' });
  logVerbose('DetectRecoveryScenario', 'No recovery scenario detected', {});
  return { scenario: 'NONE' };
}

/**
 * Handle recovery scenario
 * Returns action to take
 */
export function handleRecoveryScenario(
  detection: RecoveryDetection,
  state: SupervisorState
): { action: string; requiresOperatorInput: boolean } {
  const startTime = Date.now();
  logVerbose('HandleRecoveryScenario', 'Handling recovery scenario', {
    scenario: detection.scenario,
    details: detection.details,
    status: state.supervisor.status,
  });
  
  let result: { action: string; requiresOperatorInput: boolean };
  
  switch (detection.scenario) {
    case 'CURSOR_CRASH':
      result = {
        action: 'Reload rules & state, reissue last task',
        requiresOperatorInput: false, // Can auto-recover
      };
      logVerbose('HandleRecoveryScenario', 'CURSOR_CRASH recovery action', {
        action: result.action,
        requires_operator_input: result.requiresOperatorInput,
      });
      break;

    case 'PARTIAL_TASK':
      result = {
        action: 'Flag task as blocked, require operator input',
        requiresOperatorInput: true,
      };
      logVerbose('HandleRecoveryScenario', 'PARTIAL_TASK recovery action', {
        action: result.action,
        requires_operator_input: result.requiresOperatorInput,
      });
      break;

    case 'CONFLICTING_STATE':
      result = {
        action: 'Halt and request operator resolution',
        requiresOperatorInput: true,
      };
      logVerbose('HandleRecoveryScenario', 'CONFLICTING_STATE recovery action', {
        action: result.action,
        requires_operator_input: result.requiresOperatorInput,
      });
      break;

    case 'NONE':
      result = {
        action: 'No recovery needed',
        requiresOperatorInput: false,
      };
      logVerbose('HandleRecoveryScenario', 'NONE recovery action', {
        action: result.action,
        requires_operator_input: result.requiresOperatorInput,
      });
      break;
  }
  
  const duration = Date.now() - startTime;
  logPerformance('HandleRecoveryScenario', duration, {
    scenario: detection.scenario,
    requires_operator_input: result.requiresOperatorInput,
  });
  
  return result;
}

