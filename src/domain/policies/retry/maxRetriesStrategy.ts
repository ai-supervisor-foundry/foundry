import { RetryStrategy, RetryContext, RetryDecision } from './retryStrategy';
import { Task, SupervisorState, ValidationReport } from '../../types/types';
import { interrogateAgent } from '../../executors/interrogator'; // Domain service
import { PromptBuilder } from '../../agents/promptBuilder';
import { LoggerPort } from '../../ports/logger';
import { AuditLogPort, LegacyAuditLogEntry } from '../../ports/auditLog';
import { analyticsService } from '../../../application/services/analytics';
import * as path from 'path';

export class MaxRetriesStrategy implements RetryStrategy {
  name = 'MaxRetriesStrategy';

  constructor(
    private auditLogger: AuditLogPort & { append(entry: LegacyAuditLogEntry): Promise<void> }, // Adapter intersection for legacy
    private promptBuilder: PromptBuilder,
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
    const { iteration, cliAdapter, projectId } = context;
    const retryKey = `retry_count_${task.task_id}`;
    const retryCount = (state.supervisor as any)[retryKey] || 0;
    const maxRetries = task.retry_policy?.max_retries || 1;

    if (retryCount >= maxRetries) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Max retries (${maxRetries}) exceeded - performing final interrogation`);
        this.logger.logVerbose('ControlLoop', 'Max retries exceeded, performing final interrogation', {
          iteration,
          task_id: task.task_id,
          retry_count: retryCount,
          max_retries: maxRetries,
          validation_reason: validationReport.reason,
        });

        const sandboxCwd = path.join(this.sandboxRoot, projectId);
        const minimalState = this.promptBuilder.buildMinimalSnapshot(state, task, sandboxCwd);

        // Final interrogation
        const finalInterrogationStartTime = Date.now();
        // @todo: interrogateAgent needs to be refactored to accept LLMProviderPort
        const finalInterrogation = await interrogateAgent(
          task,
          validationReport.failed_criteria || [],
          [],
          minimalState,
          sandboxCwd,
          cliAdapter as any, // Cast for now
          0, // Final check: max 0 questions per criterion
          this.sandboxRoot,
          projectId
        );
        const finalInterrogationDuration = Date.now() - finalInterrogationStartTime;
        
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Final interrogation completed in ${finalInterrogationDuration}ms`);

        if (!finalInterrogation.all_criteria_satisfied && finalInterrogation.remaining_failed_criteria.length > 0) {
          this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Final interrogation confirms INCOMPLETE - blocking task`);
          
          this.logger.logStateTransition('TASK_IN_PROGRESS', 'TASK_BLOCKED', {
            iteration,
            task_id: task.task_id,
            reason: 'max_retries_exceeded_and_final_interrogation_confirmed_incomplete',
          });
          
          if (!state.blocked_tasks) {
            state.blocked_tasks = [];
          }
          state.blocked_tasks.push({
            task_id: task.task_id,
            blocked_at: new Date().toISOString(),
            reason: `Validation failed after ${maxRetries} retries and final interrogation confirmed incomplete: ${finalInterrogation.remaining_failed_criteria.join(', ')}`,
          });
          
          state.current_task = undefined;
          
          await this.auditLogger.append({
            event: 'TASK_BLOCKED',
            task_id: task.task_id,
            reason: `Max retries (${maxRetries}) exceeded and final interrogation confirmed incomplete`,
            validation_summary: validationReport as any, // Cast legacy
            timestamp: new Date().toISOString(),
          });

          await analyticsService.finalizeTask(task.task_id, 'BLOCKED', this.sandboxRoot, projectId);
          
          return {
              action: 'block',
              updatedState: state
          };
        } else {
            // Final interrogation confirmed completion
            this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: ✅ Final interrogation confirmed COMPLETE - marking task complete`);
            
            // We mutate the validation report? No, return action 'complete'.
            // The caller (RetryOrchestrator) needs to handle the success flow transition.
            
            return {
                action: 'complete',
                updatedState: state
            };
        }
    }

    return null; // Not max retries yet
  }
}
