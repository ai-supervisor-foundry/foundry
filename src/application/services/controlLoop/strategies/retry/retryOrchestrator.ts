import { RetryStrategy, RetryContext, RetryDecision } from '../../../../../domain/policies/retry/retryStrategy';
import { Task, SupervisorState, ValidationReport } from '../../../../../domain/types/types';
import { RepeatedErrorStrategy } from '../../../../../domain/policies/retry/repeatedErrorStrategy';
import { MaxRetriesStrategy } from '../../../../../domain/policies/retry/maxRetriesStrategy';
import { ResourceExhaustedStrategy } from '../../../../../domain/policies/retry/resourceExhaustedStrategy';
import { PromptBuilder, buildFixPrompt, buildClarificationPrompt } from '../../../../../domain/agents/promptBuilder';
import { validateTaskOutput } from '../../../validator'; // In application/services
import { checkHardHalts } from '../../../../../domain/executors/haltDetection';
import { analyticsService } from '../../../analytics'; // In application/services
import { LLMProviderPort } from '../../../../../domain/ports/llmProvider';
import { LoggerPort, PromptLoggerPort } from '../../../../../domain/ports/logger';
import { AuditLogPort, LegacyAuditLogEntry } from '../../../../../domain/ports/auditLog';
import * as path from 'path';

export class RetryOrchestrator {
  private strategies: RetryStrategy[];
  private resourceExhaustedStrategy: ResourceExhaustedStrategy;

  constructor(
    private auditLogger: AuditLogPort & { append(entry: LegacyAuditLogEntry): Promise<void> },
    private promptBuilder: PromptBuilder,
    private logger: LoggerPort,
    private promptLogger: PromptLoggerPort,
    private sandboxRoot: string
  ) {
    this.resourceExhaustedStrategy = new ResourceExhaustedStrategy(logger);
    this.strategies = [
        new RepeatedErrorStrategy(auditLogger, logger, sandboxRoot),
        new MaxRetriesStrategy(auditLogger, promptBuilder, logger, sandboxRoot)
    ];
  }

  async handleRetry(
    task: Task,
    validationReport: ValidationReport,
    state: SupervisorState,
    context: RetryContext,
    haltReason?: string | null
  ): Promise<RetryDecision> {
    const { iteration, cliAdapter, sessionId, projectId } = context;

    // 1. Check Specific Strategies (Blocking conditions)
    for (const strategy of this.strategies) {
        const decision = await strategy.handle(task, validationReport, state, context, haltReason);
        if (decision) {
            return decision;
        }
    }

    // 2. Prepare for Retry (Standard Flow)
    const retryKey = `retry_count_${task.task_id}`;
    const retryCount = (state.supervisor as any)[retryKey] || 0;
    const maxRetries = task.retry_policy?.max_retries || 1;
    
    // Increment
    (state.supervisor as any)[retryKey] = retryCount + 1;
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Retry attempt ${retryCount + 1}/${maxRetries}`);

    analyticsService.recordRetry(task.task_id, !validationReport.valid ? 'validation_failed' : 'ambiguity_or_question');

    // 3. Build Fix Prompt
    const sandboxCwd = path.join(this.sandboxRoot, projectId);
    const minimalState = this.promptBuilder.buildMinimalSnapshot(state, task, sandboxCwd);
    
    // Repeated error check for prompt construction
    const lastErrorKey = `last_error_${task.task_id}`;
    const previousError = (state.supervisor as any)[lastErrorKey];
    const isRepeatedError = previousError === validationReport.reason;

    let fixPrompt: string;
    let promptType = '';
    let logType: 'FIX_PROMPT' | 'CLARIFICATION_PROMPT' = 'FIX_PROMPT';

    if (!validationReport.valid) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Building fix prompt (validation failed)`);
        promptType = isRepeatedError ? 'strict_fix' : 'fix';
        fixPrompt = buildFixPrompt(task, minimalState, validationReport);
        if (isRepeatedError) {
          fixPrompt += '\n\n**STRICT ADHERENCE REQUIRED**: Your previous attempt failed with the EXACT same error. You MUST change your approach or provide more detailed evidence.';
        }
    } else if (haltReason && ['AMBIGUITY', 'ASKED_QUESTION'].includes(haltReason)) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Building clarification prompt (${haltReason})`);
        promptType = 'clarification';
        logType = 'CLARIFICATION_PROMPT';
        fixPrompt = buildClarificationPrompt(task, minimalState, haltReason as 'AMBIGUITY' | 'ASKED_QUESTION');
    } else {
        promptType = 'fix_fallback';
        fixPrompt = buildFixPrompt(task, minimalState, validationReport);
    }

    // 4. Log Fix Prompt
    const agentMode = task.agent_mode || 'auto';
    await this.promptLogger.appendPromptLog(
        this.sandboxRoot,
        projectId,
        {
          task_id: task.task_id,
          iteration,
          type: logType,
          content: fixPrompt,
          metadata: {
            agent_mode: agentMode,
            provider: cliAdapter.getProviderInUse(),
            working_directory: sandboxCwd,
            prompt_length: fixPrompt.length,
            intent: task.intent,
            prompt_type: promptType,
            retry_count: retryCount + 1,
          },
        }
    );

    // 5. Execute Fix Attempt
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Executing fix/clarification attempt...`);
    const fixStartTime = Date.now();
    const fixProviderResult = await cliAdapter.execute(fixPrompt, sandboxCwd, agentMode, sessionId);
    const fixDuration = Date.now() - fixStartTime;
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Fix attempt completed in ${fixDuration}ms, exit code: ${fixProviderResult.exitCode}`);
    
    this.logger.logPerformance('FixCLIAdapterExecution', fixDuration, {
        iteration,
        task_id: task.task_id,
        exit_code: fixProviderResult.exitCode,
        prompt_type: promptType,
        retry_count: retryCount + 1,
    });

    // 6. Log Fix Response
    const fixResponseContent = fixProviderResult.stdout || fixProviderResult.rawOutput || '';
    
    // Logging response via Port
    await this.promptLogger.appendPromptLog(
        this.sandboxRoot,
        projectId,
        {
          task_id: task.task_id,
          iteration,
          type: 'RESPONSE',
          content: fixResponseContent,
          metadata: {
            agent_mode: agentMode,
            provider: cliAdapter.getProviderInUse(),
            working_directory: sandboxCwd,
            response_length: fixResponseContent.length,
            exit_code: fixProviderResult.exitCode,
            duration_ms: fixDuration,
            prompt_type: promptType,
            retry_count: retryCount + 1,
          },
        }
    );

    // 7. Check Hard Halts on Fix
    const fixHaltReason = checkHardHalts({
        ...fixProviderResult,
        requiredKeys: [],
    });
    
    const criticalHaltReasons = ['BLOCKED', 'OUTPUT_FORMAT_INVALID', 'PROVIDER_CIRCUIT_BROKEN'];
    if (fixHaltReason && criticalHaltReasons.includes(fixHaltReason as any)) {
        state.supervisor.status = 'HALTED';
        state.supervisor.halt_reason = fixHaltReason;
        return { action: 'block', updatedState: state };
    }

    // 8. Re-validate Fix
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Re-validating fix attempt...`);
    const fixValidationReport = await validateTaskOutput(
        task,
        fixProviderResult,
        sandboxCwd,
        projectId
    );
    
    const fixStillHasAmbiguity = fixHaltReason && ['AMBIGUITY', 'ASKED_QUESTION'].includes(fixHaltReason);

    if (!fixValidationReport.valid || fixStillHasAmbiguity) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Fix attempt failed, will retry on next iteration`);
        (state.supervisor as any)[`retry_task`] = task; // Keep task for next iteration
        return {
            action: 'retry',
            updatedState: state
        };
    }

    // 9. Success!
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Fix attempt succeeded!`);
    
    return {
        action: 'complete',
        updatedState: state,
    };
  }
}
