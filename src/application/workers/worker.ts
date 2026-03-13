// Worker Entry Point — runs as child_process.fork() target
// Receives task via IPC, executes task lifecycle, sends results back via IPC.
// Does NOT write to supervisor state — only sends messages to the main process.

import { WorkerCommand, WorkerEvent, WorkerConfig } from './protocol';
import { Task, CompletedTask, BlockedTask, ValidationReport } from '../../domain/types/types';
import { PromptBuilder } from '../../domain/agents/promptBuilder';
import { CLIAdapter } from '../../infrastructure/adapters/agents/providers/cliAdapter';
import { Validator } from '../services/validator';
import { AuditLogger } from '../../infrastructure/adapters/logging/auditLogger';
import { SessionResolver } from '../services/controlLoop/modules/sessionResolver';
import { TaskExecutor } from '../services/controlLoop/modules/taskExecutor';
import { ValidationOrchestrator } from '../services/controlLoop/modules/validationOrchestrator';
import { RetryOrchestrator } from '../services/controlLoop/strategies/retry/retryOrchestrator';
import { StateManager } from '../services/controlLoop/modules/stateManager';
import { checkHardHalts } from '../../domain/executors/haltDetection';
import { LoggerAdapter } from '../../infrastructure/adapters/logging/loggerAdapter';
import { PromptLoggerAdapter } from '../../infrastructure/adapters/logging/promptLoggerAdapter';
import { CommandExecutorAdapter } from '../../infrastructure/adapters/os/commandExecutorAdapter';
import { PersistenceLayer } from '../services/persistence';
import Redis from 'ioredis';
import * as path from 'path';

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Worker:${process.pid}] ${message}`, data ? JSON.stringify(data) : '');
}

function send(event: WorkerEvent): void {
  if (process.send) {
    process.send(event);
  }
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(): void {
  heartbeatInterval = setInterval(() => {
    send({ type: 'HEARTBEAT' });
  }, 30000); // Every 30 seconds
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function executeTask(task: Task, worktreePath: string, config: WorkerConfig): Promise<void> {
  const workerId = `worker-${process.pid}`;
  log('Task assigned', { taskId: task.task_id, worktreePath });

  // Determine sandbox CWD — use worktree path if available, else standard sandbox
  const sandboxCwd = worktreePath || path.join(config.sandboxRoot, task.project_id);

  // Create Redis client for this worker (circuit breaker + state reads)
  const redisClient = new Redis({
    host: config.redisHost,
    port: config.redisPort,
  });

  try {
    // Initialize dependencies
    const logger = new LoggerAdapter();
    const promptLogger = new PromptLoggerAdapter();
    const commandExecutor = new CommandExecutorAdapter();
    const promptBuilder = new PromptBuilder();

    const { getActiveStrategy } = await import('../../config/agents/providers/strategies');
    const activeStrategy = getActiveStrategy();
    const primaryAdapter = new CLIAdapter(redisClient, activeStrategy.primary, config.circuitBreakerTtl, true);
    const secondaryAdapter = new CLIAdapter(redisClient, activeStrategy.secondary, config.circuitBreakerTtl);

    const validator = new Validator();
    const persistence = new PersistenceLayer(redisClient, config.stateKey);
    const stateManager = new StateManager(persistence);
    const sessionResolver = new SessionResolver();
    const auditLogger = new AuditLogger(path.join(config.sandboxRoot, task.project_id, 'audit.log.jsonl'));

    const taskExecutor = new TaskExecutor(
      promptBuilder,
      primaryAdapter,
      logger,
      promptLogger,
      config.sandboxRoot
    );

    const validationOrchestrator = new ValidationOrchestrator(
      secondaryAdapter,
      commandExecutor,
      promptBuilder,
      sessionResolver,
      stateManager,
      logger,
      promptLogger,
      config.sandboxRoot
    );

    const retryOrchestrator = new RetryOrchestrator(
      auditLogger,
      promptBuilder,
      logger,
      promptLogger,
      config.sandboxRoot
    );

    // Load current state (read-only for context)
    const state = await persistence.readState();
    const iteration = (state.supervisor.iteration || 0) + 1;

    // Execute task
    const executionResult = await taskExecutor.executeTask(task, state, iteration, sessionResolver);

    // Hard halt detection
    const haltReason = checkHardHalts({
      ...executionResult.providerResult,
      requiredKeys: [],
    });

    const criticalHaltReasons = ['BLOCKED', 'OUTPUT_FORMAT_INVALID', 'PROVIDER_CIRCUIT_BROKEN', 'RESOURCE_EXHAUSTED'];
    if (haltReason && criticalHaltReasons.includes(haltReason as string)) {
      send({
        type: 'TASK_FAILED',
        taskId: task.task_id,
        reason: `Provider halt: ${haltReason}`,
      });
      return;
    }

    // Validate
    const validationResult = await validationOrchestrator.validate(
      task,
      executionResult,
      {
        state,
        sandboxCwd: executionResult.sandboxCwd,
        projectId: task.project_id,
        iteration,
      }
    );

    // Handle retry / validation failure
    const isAmbiguity = haltReason && ['AMBIGUITY', 'ASKED_QUESTION', 'CURSOR_EXEC_FAILURE'].includes(haltReason as string);
    if (!validationResult.report.valid || isAmbiguity) {
      const retryDecision = await retryOrchestrator.handleRetry(
        task,
        validationResult.report,
        state,
        {
          cliAdapter: primaryAdapter,
          sessionId: executionResult.sessionId,
          projectId: task.project_id,
          iteration,
        },
        haltReason
      );

      if (retryDecision.action === 'block') {
        const blockedTask: BlockedTask = {
          task_id: task.task_id,
          blocked_at: new Date().toISOString(),
          reason: validationResult.report.reason || 'Validation failed after retries',
        };
        send({
          type: 'TASK_BLOCKED',
          taskId: task.task_id,
          reason: blockedTask.reason,
          blockedTask,
        });
        return;
      }

      if (retryDecision.action === 'retry') {
        // For now, treat retry exhaustion as failure in worker mode
        // The scheduler will re-enqueue if appropriate
        send({
          type: 'TASK_FAILED',
          taskId: task.task_id,
          reason: 'Retry requested — re-enqueue needed',
        });
        return;
      }

      // action === 'complete' — final interrogation confirmed completion
      validationResult.report.valid = true;
    }

    // Task completed successfully
    const completedTask: CompletedTask = {
      task_id: task.task_id,
      completed_at: new Date().toISOString(),
      intent: task.intent,
      summary: `Completed: ${task.intent.split('.')[0].trim().slice(0, 60)}`,
      validation_report: validationResult.report,
      requires_context: true,
    };

    send({
      type: 'TASK_COMPLETED',
      taskId: task.task_id,
      validationReport: validationResult.report,
      completedTask,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log('Task execution error', { taskId: task.task_id, error: reason });
    send({
      type: 'TASK_FAILED',
      taskId: task.task_id,
      reason,
    });
  } finally {
    await redisClient.quit();
  }
}

// --- IPC message handler ---
process.on('message', async (msg: WorkerCommand) => {
  switch (msg.type) {
    case 'TASK_ASSIGNED':
      await executeTask(msg.task, msg.worktreePath, msg.config);
      // Signal ready for next task
      send({ type: 'READY' });
      break;

    case 'SHUTDOWN':
      log('Shutdown received');
      stopHeartbeat();
      process.exit(0);
      break;

    case 'HALT':
      log('Halt received');
      stopHeartbeat();
      process.exit(1);
      break;
  }
});

// --- Startup ---
startHeartbeat();
send({ type: 'READY' });
log('Worker started');
