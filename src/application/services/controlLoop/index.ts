// Foundry Control Loop (Refactored & Wired for Hexagonal)
import { PersistenceLayer } from '../persistence';
import { QueueAdapter } from '../../../domain/executors/taskQueue';
import { PromptBuilder } from '../../../domain/agents/promptBuilder';
import { CLIAdapter } from '../../../infrastructure/adapters/agents/providers/cliAdapter';
import { Validator } from '../validator';
import { AuditLogger } from '../../../infrastructure/adapters/logging/auditLogger';
import { log as logShared, logVerbose, logStateTransition, logPerformance } from '../../../infrastructure/adapters/logging/logger';
import { analyticsService } from '../analytics';
import { 
    StateManager, 
    TaskRetriever, 
    GoalCompletionChecker, 
    SessionResolver, 
    TaskExecutor, 
    ValidationOrchestrator, 
    TaskFinalizer 
} from './modules';
import { HaltHandler } from '../../../domain/policies/halt/haltHandler';
import { ResourceExhaustedStrategy } from '../../../domain/policies/retry/resourceExhaustedStrategy';
import { RetryOrchestrator } from './strategies/retry/retryOrchestrator';
import { checkHardHalts } from '../../../domain/executors/haltDetection';
import { LoggerAdapter } from '../../../infrastructure/adapters/logging/loggerAdapter';
import { PromptLoggerAdapter } from '../../../infrastructure/adapters/logging/promptLoggerAdapter';
import { CommandExecutorAdapter } from '../../../infrastructure/adapters/os/commandExecutorAdapter';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function controlLoop(
  persistence: PersistenceLayer,
  queue: QueueAdapter,
  promptBuilder: PromptBuilder,
  cliAdapter: CLIAdapter,
  validator: Validator,
  auditLogger: AuditLogger,
  sandboxRoot: string
): Promise<void> {
  // Create Adapters for Ports
  const logger = new LoggerAdapter();
  const promptLogger = new PromptLoggerAdapter();
  const commandExecutor = new CommandExecutorAdapter();
  
  // Initialize modules with injected dependencies
  const stateManager = new StateManager(persistence); // PersistenceLayer implements PersistencePort
  const taskRetriever = new TaskRetriever(queue);
  
  const goalChecker = new GoalCompletionChecker(
      cliAdapter, 
      logger,
      promptLogger,
      sandboxRoot
  );
  
  const sessionResolver = new SessionResolver();
  
  const taskExecutor = new TaskExecutor(
      promptBuilder, 
      cliAdapter, 
      logger,
      promptLogger,
      sandboxRoot
  );
  
  const validationOrchestrator = new ValidationOrchestrator(
      cliAdapter, 
      commandExecutor,
      promptBuilder, 
      sessionResolver, 
      stateManager, 
      logger,
      promptLogger,
      sandboxRoot
  );
  
  const retryOrchestrator = new RetryOrchestrator(
      auditLogger, 
      promptBuilder, 
      logger,
      promptLogger,
      sandboxRoot
  );
  
  const taskFinalizer = new TaskFinalizer(
      persistence, 
      auditLogger,
      logger
  );
  
  const haltHandler = new HaltHandler(
      persistence, 
      auditLogger,
      logger
  );
  
  const resourceExhaustedStrategy = new ResourceExhaustedStrategy(logger);

  let iteration = 0;
  logShared('ControlLoop', 'Control loop started');

  while (true) {
    iteration++;
    const iterationStartTime = Date.now();
    logVerbose('ControlLoop', `Starting iteration ${iteration}`);

    // 1. Load and validate state
    const stateBefore = await stateManager.loadState(iteration);
    const state = stateManager.deepCopyState(stateBefore, iteration);
    
    try {
        stateManager.validateRequiredFields(state, iteration);
    } catch (error) {
        await haltHandler.halt(state, 'MISSING_STATE_FIELD', iteration, error instanceof Error ? error.message : String(error));
    }

    // 2. Check supervisor status
    if ((state.supervisor.status as string) !== 'RUNNING') {
      if (state.supervisor.resource_exhausted_retry) {
        const { shouldWait, remainingMs } = resourceExhaustedStrategy.shouldWait(state, Date.now());
        if (shouldWait) {
          const waitMinutes = Math.ceil(remainingMs / (60 * 1000));
          if (iteration % 60 === 0 || remainingMs < 60000) {
              logShared('ControlLoop', `[Iteration ${iteration}] Resource exhausted retry wait: ${waitMinutes} minutes remaining`);
          }
          await sleep(Math.min(remainingMs, 60000));
          continue;
        }
        // Cleared inside TaskFinalizer on success, but here we just resume
      }
      
      if (state.supervisor.status !== 'RUNNING') {
        logShared('ControlLoop', `[Iteration ${iteration}] Status is ${state.supervisor.status}, sleeping...`);
        await sleep(1000);
        continue;
      }
    }
    
    logStateTransition('CHECKING', 'RUNNING', { iteration });

    // 3. Retrieve task (with recovery)
    const { task, source: taskSource } = await taskRetriever.retrieveTask(state, iteration);
    
    // 4. Handle no task (goal completion check)
    if (!task) {
        const goalResult = await goalChecker.checkGoalCompletion(state, iteration);
        
        if (goalResult.shouldHalt) {
            await haltHandler.halt(state, 'TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE', iteration, goalResult.reason);
        }
        
        if (goalResult.completed) {
            logShared('ControlLoop', `[Iteration ${iteration}] Queue exhausted, goal completed - exiting`);
            state.supervisor.status = 'COMPLETED';
            await stateManager.persistState(state, iteration);
            await auditLogger.append({ event: 'COMPLETED', timestamp: new Date().toISOString() });
            return;
        }
        
        await stateManager.persistState(state, iteration);
        await sleep(1000);
        continue;
    }

    analyticsService.initializeTask(task.task_id);
    analyticsService.recordIteration(task.task_id);

    // 5. Set current_task and persist
    state.current_task = task;
    await stateManager.persistState(state, iteration, task.task_id);

    // 6. Execute task
    const executionResult = await taskExecutor.executeTask(task, state, iteration, sessionResolver);

    // 7. Update session state
    if (executionResult.sessionId) {
        sessionResolver.updateSessionState(
            state,
            executionResult.featureId,
            executionResult.sessionId,
            task,
            executionResult.providerResult.usage?.tokens || 0,
            executionResult.resolvedSessionId,
            iteration
        );
    }

    // 8. Halt Detection (Hard Halts)
    const haltReason = checkHardHalts({
        ...executionResult.providerResult,
        requiredKeys: [], // Logic for required keys can be moved to executor if needed
    });

    if (haltReason === 'RESOURCE_EXHAUSTED') {
        const scheduled = resourceExhaustedStrategy.scheduleRetry(state, task, iteration);
        if (!scheduled) {
            await haltHandler.halt(state, 'RESOURCE_EXHAUSTED', iteration, 'Max retries exceeded');
        }
        await stateManager.persistState(state, iteration, task.task_id);
        continue;
    }

    const criticalHaltReasons = ['BLOCKED', 'OUTPUT_FORMAT_INVALID', 'PROVIDER_CIRCUIT_BROKEN'];
    if (haltReason && criticalHaltReasons.includes(haltReason as any)) {
        await haltHandler.halt(state, haltReason as any, iteration, `Provider output triggered halt: ${haltReason}`);
    }

    // 9. Validate task output
    const validationResult = await validationOrchestrator.validate(
      task,
      executionResult,
      {
        state,
        sandboxCwd: executionResult.sandboxCwd,
        projectId: state.goal.project_id || 'default',
        iteration,
      }
    );

    // 10. Handle Retry
    const isAmbiguity = haltReason && ['AMBIGUITY', 'ASKED_QUESTION', 'CURSOR_EXEC_FAILURE'].includes(haltReason);
    if (!validationResult.report.valid || isAmbiguity) {
        const retryDecision = await retryOrchestrator.handleRetry(
            task,
            validationResult.report,
            state,
            {
                cliAdapter,
                sessionId: executionResult.sessionId,
                projectId: state.goal.project_id || 'default',
                iteration,
            },
            haltReason
        );

        if (retryDecision.action === 'block') {
            await stateManager.persistState(retryDecision.updatedState, iteration, task.task_id);
            continue;
        }

        if (retryDecision.action === 'retry') {
            await stateManager.persistState(retryDecision.updatedState, iteration, task.task_id);
            continue;
        }

        // action === 'complete' (Confirmed by final interrogation)
        validationResult.report.valid = true;
    }

    // 11. Finalize task
    await taskFinalizer.finalizeTask(
        state,
        {
            stateBefore,
            task,
            validationReport: validationResult.report,
            sandboxRoot,
            projectId: state.goal.project_id || 'default',
            iteration,
            finalPrompt: executionResult.prompt,
            finalResponse: executionResult.response
        }
    );

    logPerformance('Iteration', Date.now() - iterationStartTime, { iteration, task_id: task.task_id });
  }
}