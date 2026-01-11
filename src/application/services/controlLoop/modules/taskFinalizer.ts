import { SupervisorState, Task, ValidationReport, CompletedTask } from '../../../../domain/types/types';
import { PersistencePort } from '../../../../domain/ports/persistence';
import { AuditLogPort } from '../../../../domain/ports/auditLog';
import { LoggerPort } from '../../../../domain/ports/logger';
import { analyticsService } from '../../analytics';

export interface FinalizationContext {
  stateBefore: SupervisorState;
  task: Task;
  validationReport: ValidationReport;
  sandboxRoot: string;
  projectId: string;
  iteration: number;
  finalPrompt: string;
  finalResponse: string;
}

export class TaskFinalizer {
  constructor(
    private persistence: PersistencePort,
    private auditLogger: AuditLogPort,
    private logger: LoggerPort
  ) {}

  async finalizeTask(state: SupervisorState, context: FinalizationContext): Promise<void> {
    const { task, validationReport, stateBefore, sandboxRoot, projectId, iteration, finalPrompt, finalResponse } = context;
    const stateUpdateStartTime = Date.now();
    
    // 1. Update State Metadata
    const previousIteration = state.supervisor.iteration || 0;
    state.supervisor.iteration = previousIteration + 1;
    state.supervisor.last_task_id = task.task_id;
    state.supervisor.last_validation_report = validationReport;
    
    // 2. Mark as completed with semantic information
    if (!state.completed_tasks) {
      state.completed_tasks = [];
    }

    const completedTask: CompletedTask = {
      task_id: task.task_id,
      completed_at: new Date().toISOString(),
      intent: task.intent,
      summary: this.generateTaskSummary(task, validationReport),
      validation_report: validationReport,
      requires_context: true,
    };

    state.completed_tasks.push(completedTask);

    // Prune old tasks to cap state size
    state.completed_tasks = this.pruneCompletedTasks(state.completed_tasks);
    
    // 3. Cleanup current task and retry state
    state.current_task = undefined;
    if (state.supervisor.resource_exhausted_retry) {
      this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Clearing resource_exhausted_retry after successful completion`);
      delete state.supervisor.resource_exhausted_retry;
      if (state.supervisor.halt_reason === 'RESOURCE_EXHAUSTED') {
        delete state.supervisor.halt_reason;
        delete state.supervisor.halt_details;
      }
    }
    
    const stateUpdateDuration = Date.now() - stateUpdateStartTime;
    this.logger.logPerformance('StateUpdate', stateUpdateDuration, { iteration, task_id: task.task_id });

    // 4. Analytics
    analyticsService.logSummary(task.task_id);
    await analyticsService.finalizeTask(task.task_id, 'COMPLETED', sandboxRoot, projectId);
    
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: ✅ COMPLETED`);
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Completed tasks: ${state.completed_tasks.length}`);
    this.logger.logStateTransition('TASK_IN_PROGRESS', 'TASK_COMPLETED', {
      iteration,
      task_id: task.task_id,
    });

    // 5. Persist State
    const persistStartTime = Date.now();
    await this.persistence.writeState(state);
    const persistDuration = Date.now() - persistStartTime;
    this.logger.logPerformance('StatePersist', persistDuration, {
      iteration,
      task_id: task.task_id,
      state_size: JSON.stringify(state).length,
    });

    // 6. Audit Log
    const auditLogStartTime = Date.now();
    await this.auditLogger.appendAuditLog(
      stateBefore,
      state,
      task,
      validationReport,
      sandboxRoot,
      projectId,
      finalPrompt,
      finalResponse
    );
    const auditLogDuration = Date.now() - auditLogStartTime;
    this.logger.logPerformance('AuditLogAppend', auditLogDuration, { iteration, task_id: task.task_id });
  }

  /**
   * Generate deterministic summary (no LLM, no creativity)
   * Only facts: success/failure + reason
   */
  private generateTaskSummary(task: Task, report: ValidationReport): string {
    if (!report.valid) {
      return `Failed: ${report.reason || 'Unknown reason'}`;
    }
    
    // Extract first sentence of intent (up to first period or 60 chars)
    const firstSentence = task.intent.split('.')[0].trim();
    const truncated = firstSentence.length > 60 
      ? firstSentence.slice(0, 60) + '...' 
      : firstSentence;
    
    return `Completed: ${truncated}`;
  }

  /**
   * Keep completed_tasks capped at 100 entries
   * Keeps only most recent tasks in-memory state
   * Full history remains in audit.log.jsonl
   */
  private pruneCompletedTasks(tasks: CompletedTask[]): CompletedTask[] {
    const MAX_RECENT_TASKS = 100;
    
    if (tasks.length <= MAX_RECENT_TASKS) {
      return tasks;
    }
    
    const pruned = tasks.slice(-MAX_RECENT_TASKS);
    const removed = tasks.length - pruned.length;
    
    this.logger.log('TaskFinalizer', 'Pruned completed_tasks', {
      total: tasks.length,
      kept: pruned.length,
      removed,
      max_cap: MAX_RECENT_TASKS,
    });
    
    return pruned;
  }
}