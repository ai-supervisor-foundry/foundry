import { SupervisorState, Task, ValidationReport } from '../../../../domain/types/types';
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
    
    // 2. Mark as completed
    if (!state.completed_tasks) {
      state.completed_tasks = [];
    }
    state.completed_tasks.push({
      task_id: task.task_id,
      completed_at: new Date().toISOString(),
      validation_report: validationReport,
    });
    
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
}