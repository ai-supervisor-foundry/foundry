import { RetryStrategy, RetryContext, RetryDecision } from './retryStrategy';
import { Task, SupervisorState, ValidationReport } from '../../types/types';
import { LoggerPort } from '../../ports/logger';
import { AuditLogPort, LegacyAuditLogEntry } from '../../ports/auditLog';
import { analyticsService } from '../../../application/services/analytics';

export class RepeatedErrorStrategy implements RetryStrategy {
  name = 'RepeatedErrorStrategy';

  constructor(
    private auditLogger: AuditLogPort & { append(entry: LegacyAuditLogEntry): Promise<void> }, 
    private logger: LoggerPort,
    private sandboxRoot: string
  ) {}

  async handle(
    task: Task,
    validationReport: ValidationReport,
    state: SupervisorState,
    context: RetryContext,
    haltReason?: string | null
  ): Promise<RetryDecision | null> {
    const { iteration, projectId } = context;

    // Track repeated errors
    const lastErrorKey = `last_error_${task.task_id}`;
    const repeatedCountKey = `repeated_error_count_${task.task_id}`;
    const previousError = (state.supervisor as any)[lastErrorKey];
    const currentError = validationReport.reason;
    const isRepeatedError = previousError === currentError;
    
    let repeatedErrorCount = (state.supervisor as any)[repeatedCountKey] || 0;
    
    if (isRepeatedError) {
      repeatedErrorCount++;
    } else {
      repeatedErrorCount = 0;
    }
    
    // Update state
    (state.supervisor as any)[lastErrorKey] = currentError;
    (state.supervisor as any)[repeatedCountKey] = repeatedErrorCount;

    if (repeatedErrorCount >= 3) {
      this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Repeated error limit (3) exceeded - blocking task`);
      this.logger.logVerbose('ControlLoop', 'Blocking task due to repeated errors', {
        iteration,
        task_id: task.task_id,
        error: currentError,
        repeated_count: repeatedErrorCount,
      });
      
      this.logger.logStateTransition('TASK_IN_PROGRESS', 'TASK_BLOCKED', {
        iteration,
        task_id: task.task_id,
        reason: 'repeated_validation_error',
      });
      
      if (!state.blocked_tasks) {
        state.blocked_tasks = [];
      }
      state.blocked_tasks.push({
        task_id: task.task_id,
        blocked_at: new Date().toISOString(),
        reason: `Validation failed with identical error 3 times in a row: ${currentError}`,
      });
      
      state.current_task = undefined;
      
      await this.auditLogger.append({
        event: 'TASK_BLOCKED',
        task_id: task.task_id,
        reason: `Repeated validation error limit exceeded: ${currentError}`,
        validation_summary: validationReport as any,
        timestamp: new Date().toISOString(),
      });
      
      await analyticsService.finalizeTask(task.task_id, 'BLOCKED', this.sandboxRoot, projectId);
      
      return {
        action: 'block',
        updatedState: state
      };
    }

    return null; // Continue to next strategy (normal retry)
  }
}
