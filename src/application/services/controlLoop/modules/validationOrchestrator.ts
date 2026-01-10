import { PromptBuilder } from '../../../../domain/agents/promptBuilder';
import { SupervisorState, Task, ValidationReport } from '../../../../domain/types/types';
import { ExecutionResult } from './taskExecutor';
import { SessionResolver } from './sessionResolver';
import { StateManager } from './stateManager';
import { ValidationContext, ValidationStrategy } from '../../../../domain/policies/validation/validationStrategy';
import { StandardValidator } from '../../../../domain/policies/validation/standardValidator';
import { DeterministicValidator } from '../../../../domain/policies/validation/deterministicValidator';
import { HelperAgentValidator } from '../../../../domain/policies/validation/helperAgentValidator';
import { InterrogationValidator } from '../../../../domain/policies/validation/interrogationValidator';
import { LLMProviderPort } from '../../../../domain/ports/llmProvider';
import { CommandExecutorPort } from '../../../../domain/ports/commandExecutor';
import { LoggerPort, PromptLoggerPort } from '../../../../domain/ports/logger';

export interface OrchestrationContext {
    state: SupervisorState;
    sandboxCwd: string;
    projectId: string;
    iteration: number;
}

export interface ValidationResult {
    report: ValidationReport;
    needsRetry: boolean;
    needsInterrogation: boolean;
    haltReason?: string;
}

export class ValidationOrchestrator {
    private strategies: ValidationStrategy[];

    constructor(
        private cliAdapter: LLMProviderPort,
        private commandExecutor: CommandExecutorPort,
        private promptBuilder: PromptBuilder,
        private sessionResolver: SessionResolver,
        private stateManager: StateManager,
        private logger: LoggerPort,
        private promptLogger: PromptLoggerPort,
        private sandboxRoot: string
    ) {
        this.strategies = [
            new StandardValidator(logger),
            new DeterministicValidator(logger),
            new HelperAgentValidator(cliAdapter, commandExecutor, logger, promptLogger, sessionResolver, sandboxRoot),
            new InterrogationValidator(cliAdapter, promptBuilder, logger, sandboxRoot)
        ];
    }

    async validate(
        task: Task,
        executionResult: ExecutionResult,
        context: OrchestrationContext
    ): Promise<ValidationResult> {
        const validationContext: ValidationContext = {
            state: context.state,
            sandboxCwd: context.sandboxCwd,
            projectId: context.projectId,
            iteration: context.iteration
        };

        let currentReport: ValidationReport | undefined;

        for (const strategy of this.strategies) {
            // Check for interrogation pre-persistence requirement
            if (strategy instanceof InterrogationValidator) {
                 const needsInterrogation = !currentReport?.valid && 
                    task.task_type !== 'behavioral' &&
                    (currentReport?.confidence === 'UNCERTAIN' || 
                    (currentReport?.confidence === 'LOW' && currentReport?.uncertain_criteria && currentReport?.uncertain_criteria.length > 0));
                
                if (needsInterrogation) {
                    // Pre-persist interrogation flag to prevent loops on crash
                    const retryKey = `retry_count_${task.task_id}`;
                    const retryCount = (context.state.supervisor as any)[retryKey] || 0;
                    const interrogationKey = `interrogation_performed_${task.task_id}_attempt_${retryCount}`;
                    
                    if (!(context.state.supervisor as any)[interrogationKey]) {
                        (context.state.supervisor as any)[interrogationKey] = true;
                        this.logger.log('ControlLoop', `[Iteration ${context.iteration}] Persisting interrogation flag for task ${task.task_id}`);
                        await this.stateManager.persistState(context.state, context.iteration, task.task_id);
                    }
                }
            }

            currentReport = await strategy.validate(
                task,
                executionResult.providerResult,
                validationContext,
                currentReport
            );

            // If valid, short-circuit
            if (currentReport.valid) {
                break;
            }
        }

        if (!currentReport) {
            throw new Error("Validation strategies failed to produce a report");
        }

        return {
            report: currentReport,
            needsRetry: !currentReport.valid,
            needsInterrogation: false // Handled inside InterrogationValidator now
        };
    }
}