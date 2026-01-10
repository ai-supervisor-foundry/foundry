import { RetryStrategy, RetryContext, RetryDecision } from './retryStrategy';
import { Task, SupervisorState, ValidationReport } from '../../types/types';
import { LoggerPort } from '../../ports/logger';

export class ResourceExhaustedStrategy implements RetryStrategy {
    name = 'ResourceExhaustedStrategy';
    
    // Resource exhaustion backoff intervals: 1min, 5min, 20min, 1hr, 2hr
    private readonly RESOURCE_EXHAUSTED_BACKOFF_MS = [
        1 * 60 * 1000,      // 1 minute
        5 * 60 * 1000,      // 5 minutes
        20 * 60 * 1000,     // 20 minutes
        60 * 60 * 1000,     // 1 hour
        2 * 60 * 60 * 1000, // 2 hours
    ] as const;

    private readonly MAX_RESOURCE_EXHAUSTED_RETRIES = 5;

    constructor(private logger: LoggerPort) {}

    // Helper to check if we should wait (used at start of loop)
    shouldWait(state: SupervisorState, now: number): { shouldWait: boolean, remainingMs: number } {
        if (!state.supervisor.resource_exhausted_retry) return { shouldWait: false, remainingMs: 0 };
        
        const nextRetryAt = new Date(state.supervisor.resource_exhausted_retry.next_retry_at).getTime();
        if (now < nextRetryAt) {
            return { shouldWait: true, remainingMs: nextRetryAt - now };
        }
        return { shouldWait: false, remainingMs: 0 };
    }

    scheduleRetry(state: SupervisorState, task: Task, iteration: number): boolean {
        const currentRetry = state.supervisor.resource_exhausted_retry?.attempt || 0;
        const nextAttempt = currentRetry + 1;
        
        if (nextAttempt > this.MAX_RESOURCE_EXHAUSTED_RETRIES) {
             return false; // Max retries exceeded
        }

        const backoffMs = this.RESOURCE_EXHAUSTED_BACKOFF_MS[nextAttempt - 1] || this.RESOURCE_EXHAUSTED_BACKOFF_MS[this.RESOURCE_EXHAUSTED_BACKOFF_MS.length - 1];
        const now = Date.now();
        const nextRetryAt = new Date(now + backoffMs).toISOString();
        const backoffMinutes = Math.ceil(backoffMs / (60 * 1000));

        state.supervisor.resource_exhausted_retry = {
            attempt: nextAttempt,
            last_attempt_at: new Date(now).toISOString(),
            next_retry_at: nextRetryAt,
        };
        state.supervisor.halt_reason = 'RESOURCE_EXHAUSTED';
        state.supervisor.halt_details = `Resource exhausted, retry ${nextAttempt}/${this.MAX_RESOURCE_EXHAUSTED_RETRIES} in ${backoffMinutes} minutes`;
        
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Resource exhausted - scheduling retry ${nextAttempt}/${this.MAX_RESOURCE_EXHAUSTED_RETRIES} in ${backoffMinutes} minutes`);
        
        // We persist state in caller
        return true;
    }

    async handle(
        task: Task,
        validationReport: ValidationReport,
        state: SupervisorState,
        context: RetryContext,
        haltReason?: string | null
    ): Promise<RetryDecision | null> {
        // This strategy is usually invoked explicitly by HaltHandler or ControlLoop when haltReason === 'RESOURCE_EXHAUSTED'
        // But implementing handle() for interface consistency
        if (haltReason === 'RESOURCE_EXHAUSTED') {
            const scheduled = this.scheduleRetry(state, task, context.iteration);
            if (!scheduled) {
                // Return null to let caller handle halt (block/fatal)
                return null;
            }
            // If scheduled, we "retry" by returning action 'retry' (which saves state and continues loop)
            // But strictly speaking, we want to Halt/Sleep. 
            // In original code: "continue" loop to hit sleep check.
            return {
                action: 'retry',
                updatedState: state
            };
        }
        return null;
    }
}
