// Parallel Scheduler — replaces monolithic control loop for multi-worker execution.
// Manages worker pool, file locking, git worktree isolation, dependency promotion.
// Supervisor serializes all state writes — workers only send messages.

import { PersistenceLayer } from '../persistence';
import { DualQueueAdapter } from '../../../domain/executors/taskQueue';
import { WorkerPool } from '../../workers/workerPool';
import { WorkerConfig, WorkerEvent } from '../../workers/protocol';
import { FileLockManager } from '../../../infrastructure/network/resilience/fileLockManager';
import { WorktreeManager } from '../../../infrastructure/adapters/os/worktreeManager';
import { acquireLocksWithBackoff } from '../../../domain/executors/lockAcquisition';
import { GoalCompletionChecker } from '../controlLoop/modules/goalCompletionChecker';
import { AuditLogger } from '../../../infrastructure/adapters/logging/auditLogger';
import { LoggerPort } from '../../../domain/ports/logger';
import { Task, SupervisorState } from '../../../domain/types/types';

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Scheduler] ${message}`, data ? JSON.stringify(data) : '');
}

export async function scheduler(
  persistence: PersistenceLayer,
  dualQueue: DualQueueAdapter,
  workerPool: WorkerPool,
  lockManager: FileLockManager,
  worktreeManager: WorktreeManager,
  goalChecker: GoalCompletionChecker,
  auditLogger: AuditLogger,
  workerConfig: WorkerConfig,
  sandboxRoot: string,
  logger: LoggerPort,
  maxIterations: number = Infinity
): Promise<void> {
  let iteration = 0;
  let running = true;

  // Graceful shutdown on SIGINT/SIGTERM
  const shutdownHandler = async () => {
    log('Shutdown signal received');
    running = false;
  };
  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);

  // Initialize worker pool
  await workerPool.init();
  log('Scheduler started', { maxWorkers: workerPool.totalWorkers });

  // Track active dispatches (promises that resolve on worker completion)
  const activeDispatches: Map<string, Promise<{ taskId: string; event: WorkerEvent }>> = new Map();

  try {
    while (running && iteration < maxIterations) {
      iteration++;

      // 1. Load state
      const state = await persistence.readState();

      // 2. Check supervisor status
      if (state.supervisor.status !== 'RUNNING') {
        log(`Status is ${state.supervisor.status}, sleeping...`);
        await sleep(1000);
        continue;
      }

      // 3. Recover interrupted active_tasks from crash
      if (state.active_tasks && Object.keys(state.active_tasks).length > 0 && activeDispatches.size === 0) {
        log('Recovering interrupted active tasks', { count: Object.keys(state.active_tasks).length });
        for (const [taskId, activeTask] of Object.entries(state.active_tasks)) {
          // Re-enqueue interrupted tasks
          await dualQueue.enqueue(activeTask.task);
          await lockManager.releaseAll(taskId);
          log('Re-enqueued interrupted task', { taskId });
        }
        state.active_tasks = {};
        await persistence.writeState(state);
        continue;
      }

      // 4. Check for completion — no ready, no waiting, no active workers
      const readyCount = await dualQueue.readyCount();
      const waitingCount = await dualQueue.waitingCount();

      if (readyCount === 0 && waitingCount === 0 && activeDispatches.size === 0) {
        // Queue exhausted — check goal completion
        state.queue.exhausted = true;
        state.queue.ready_count = 0;
        state.queue.waiting_count = 0;

        const goalResult = await goalChecker.checkGoalCompletion(state, iteration);

        if (goalResult.completed) {
          log('All goals completed — exiting');
          state.supervisor.status = 'COMPLETED';
          for (const goal of Object.values(state.goals)) {
            goal.completed = true;
          }
          await persistence.writeState(state);
          await auditLogger.append({ event: 'COMPLETED', timestamp: new Date().toISOString() });
          return;
        }

        if (goalResult.shouldHalt) {
          log('Goals incomplete and queue exhausted — halting');
          state.supervisor.status = 'HALTED';
          state.supervisor.halt_reason = 'TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE';
          state.supervisor.halt_details = goalResult.reason;
          await persistence.writeState(state);
          return;
        }

        await persistence.writeState(state);
        await sleep(1000);
        continue;
      }

      // 5. Dispatch tasks to available workers
      while (workerPool.availableWorkers > 0 && readyCount > 0) {
        const task = await dualQueue.dequeueReady();
        if (!task) break;

        // Try acquire file locks
        const locksAcquired = await acquireLocksWithBackoff(lockManager, task, `pool`, {
          maxRetries: 5,
          initialDelayMs: 100,
          maxDelayMs: 2000,
          timeoutMs: 30000, // 30s timeout for lock acquisition during dispatch
        });

        if (!locksAcquired) {
          // Re-enqueue to back of ready queue
          log('Lock contention, re-enqueuing task', { taskId: task.task_id });
          await dualQueue.enqueue(task);
          break; // Try again next iteration
        }

        // Create git worktree
        let worktreePath: string;
        try {
          worktreePath = await worktreeManager.create(task.project_id, task.task_id, `pool`);
        } catch (error) {
          log('Worktree creation failed', { taskId: task.task_id, error: String(error) });
          await lockManager.releaseAll(task.task_id);
          await dualQueue.enqueue(task);
          break;
        }

        // Record in state
        if (!state.active_tasks) state.active_tasks = {};
        state.active_tasks[task.task_id] = {
          task,
          worker_id: `pool`,
          started_at: new Date().toISOString(),
          worktree_path: worktreePath,
        };

        // Update queue counts
        state.queue.exhausted = false;
        state.queue.ready_count = await dualQueue.readyCount();
        state.queue.waiting_count = await dualQueue.waitingCount();

        await persistence.writeState(state);

        // Dispatch to worker (non-blocking)
        const dispatchPromise = workerPool.dispatch(task, worktreePath, workerConfig)
          .then(event => ({ taskId: task.task_id, event }));

        activeDispatches.set(task.task_id, dispatchPromise);
        log('Task dispatched', { taskId: task.task_id, worktreePath });
      }

      // 6. Wait for any worker completion (or timeout for next check)
      if (activeDispatches.size > 0) {
        const completed = await Promise.race([
          ...activeDispatches.values(),
          sleep(5000).then(() => null), // Check every 5s even if no completion
        ]);

        if (completed) {
          activeDispatches.delete(completed.taskId);
          const freshState = await persistence.readState();

          await handleWorkerCompletion(
            completed.taskId,
            completed.event,
            freshState,
            persistence,
            dualQueue,
            lockManager,
            worktreeManager,
            auditLogger,
            sandboxRoot,
          );
        }
      } else {
        await sleep(1000);
      }
    }
  } finally {
    process.removeListener('SIGINT', shutdownHandler);
    process.removeListener('SIGTERM', shutdownHandler);

    // Release all locks and shut down workers
    for (const taskId of activeDispatches.keys()) {
      await lockManager.releaseAll(taskId);
    }
    await workerPool.shutdown();
    log('Scheduler stopped');
  }
}

async function handleWorkerCompletion(
  taskId: string,
  event: WorkerEvent,
  state: SupervisorState,
  persistence: PersistenceLayer,
  dualQueue: DualQueueAdapter,
  lockManager: FileLockManager,
  worktreeManager: WorktreeManager,
  auditLogger: AuditLogger,
  sandboxRoot: string,
): Promise<void> {
  // Get worktree path before removing from active_tasks
  const activeTask = state.active_tasks?.[taskId];
  const worktreePath = activeTask?.worktree_path;
  const projectId = activeTask?.task.project_id;

  // Release file locks
  await lockManager.releaseAll(taskId);

  switch (event.type) {
    case 'TASK_COMPLETED': {
      // Merge worktree
      if (worktreePath && projectId) {
        try {
          await worktreeManager.mergeAndRemove(worktreePath, projectId);
        } catch (error) {
          log('Worktree merge failed', { taskId, error: String(error) });
          // Continue — task is still completed, merge conflict can be resolved manually
        }
      }

      // Update state
      if (!state.completed_tasks) state.completed_tasks = [];
      state.completed_tasks = state.completed_tasks.filter(t => t.task_id !== taskId);
      state.completed_tasks.push(event.completedTask);
      if (state.active_tasks) delete state.active_tasks[taskId];

      state.supervisor.last_task_id = taskId;
      state.supervisor.last_validation_report = event.validationReport;
      state.supervisor.iteration = (state.supervisor.iteration || 0) + 1;

      // Promote dependents
      const completedIds = (state.completed_tasks || []).map(t => t.task_id);
      const promoted = await dualQueue.promoteReadyTasks(completedIds);
      if (promoted.length > 0) {
        log('Promoted dependent tasks', { promoted: promoted.map(t => t.task_id) });
      }

      state.queue.ready_count = await dualQueue.readyCount();
      state.queue.waiting_count = await dualQueue.waitingCount();

      await persistence.writeState(state);
      await auditLogger.append({
        event: 'TASK_COMPLETED',
        task_id: taskId,
        timestamp: new Date().toISOString(),
      });

      log('Task completed', { taskId });
      break;
    }

    case 'TASK_FAILED': {
      // Remove worktree without merge
      if (worktreePath) {
        await worktreeManager.remove(worktreePath);
      }

      // Block the task
      if (!state.blocked_tasks) state.blocked_tasks = [];
      state.blocked_tasks = state.blocked_tasks.filter(t => t.task_id !== taskId);
      state.blocked_tasks.push({
        ...(activeTask?.task || {}),
        task_id: taskId,
        blocked_at: new Date().toISOString(),
        reason: event.reason,
      });
      if (state.active_tasks) delete state.active_tasks[taskId];

      await persistence.writeState(state);
      await auditLogger.append({
        event: 'TASK_FAILED',
        task_id: taskId,
        reason: event.reason,
        timestamp: new Date().toISOString(),
      });

      log('Task failed', { taskId, reason: event.reason });
      break;
    }

    case 'TASK_BLOCKED': {
      // Remove worktree without merge
      if (worktreePath) {
        await worktreeManager.remove(worktreePath);
      }

      if (!state.blocked_tasks) state.blocked_tasks = [];
      state.blocked_tasks = state.blocked_tasks.filter(t => t.task_id !== taskId);
      state.blocked_tasks.push(event.blockedTask);
      if (state.active_tasks) delete state.active_tasks[taskId];

      await persistence.writeState(state);
      await auditLogger.append({
        event: 'TASK_BLOCKED',
        task_id: taskId,
        reason: event.reason,
        timestamp: new Date().toISOString(),
      });

      log('Task blocked', { taskId, reason: event.reason });
      break;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
