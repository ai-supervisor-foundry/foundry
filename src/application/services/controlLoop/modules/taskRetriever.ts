import Redis from 'ioredis';
import { QueueAdapter } from '../../../../domain/executors/taskQueue';
import { SupervisorState, Task } from '../../../../domain/types/types';
import { log as logShared, logVerbose, logPerformance } from '../../../../infrastructure/adapters/logging/logger';

const TASK_LOCK_TTL = 15; // seconds

export interface TaskRetrievalResult {
  task: Task | null;
  source: 'active_task_recovery' | 'retry_task' | 'queue' | 'none';
}

export class TaskRetriever {
  constructor(
    private queue: QueueAdapter,
    private redisClient?: Redis
  ) {}

  /**
   * Acquire a Redis-based task lock (SET NX EX).
   * Returns true if lock acquired, false if already locked.
   */
  private async acquireTaskLock(taskId: string): Promise<boolean> {
    if (!this.redisClient) return true; // No client = no locking (backwards compat)
    const key = `tasklock:${taskId}`;
    const result = await this.redisClient.set(key, Date.now().toString(), 'EX', TASK_LOCK_TTL, 'NX');
    return result === 'OK';
  }

  /**
   * Release a task lock.
   */
  async releaseTaskLock(taskId: string): Promise<void> {
    if (!this.redisClient) return;
    await this.redisClient.del(`tasklock:${taskId}`);
  }

  async retrieveTask(state: SupervisorState, iteration: number): Promise<TaskRetrievalResult> {
    const taskRetrievalStartTime = Date.now();
    logVerbose('ControlLoop', 'Retrieving task', { iteration });

    let task: Task | null = null;
    let taskSource: TaskRetrievalResult['source'] = 'none';

    // 1. Recover interrupted task from active_tasks
    const activeTaskEntries = state.active_tasks ? Object.values(state.active_tasks) : [];
    if (activeTaskEntries.length > 0) {
      // In sequential mode, recover the first (only) active task
      const activeEntry = activeTaskEntries[0];
      task = activeEntry.task;
      taskSource = 'active_task_recovery';
      logShared('ControlLoop', `[Iteration ${iteration}] Recovering interrupted task: ${task.task_id}`);
      logVerbose('ControlLoop', 'Recovered interrupted task from active_tasks', {
        iteration,
        task_id: task.task_id,
        intent: task.intent,
        worker_id: activeEntry.worker_id,
      });
    }
    // 2. Recover retry task
    else if ((state.supervisor as any).retry_task) {
      task = (state.supervisor as any).retry_task;
      taskSource = 'retry_task';
      if (task) {
        const retryCount = (state.supervisor as any)[`retry_count_${task.task_id}`] || 0;
        delete (state.supervisor as any).retry_task; // Clear retry task after retrieving
        logShared('ControlLoop', `[Iteration ${iteration}] Retrieved retry task: ${task.task_id}`);
        logVerbose('ControlLoop', 'Retrieved retry task from state', {
          iteration,
          task_id: task.task_id,
          retry_count: retryCount,
          intent: task.intent,
          status: task.status,
        });
      }
    }
    // 3. Dequeue from queue
    else {
      const dequeueStartTime = Date.now();
      task = await this.queue.dequeue();
      const dequeueDuration = Date.now() - dequeueStartTime;
      logPerformance('TaskDequeue', dequeueDuration, { iteration });
      taskSource = 'queue';

      if (task) {
        logShared('ControlLoop', `[Iteration ${iteration}] Dequeued task from queue: ${task.task_id}`);
        logVerbose('ControlLoop', 'Dequeued task from queue', {
          iteration,
          task_id: task.task_id,
          intent: task.intent,
          tool: task.tool,
          acceptance_criteria_count: task.acceptance_criteria?.length || 0,
          has_retry_policy: !!task.retry_policy,
          working_directory: task.working_directory,
        });
      } else {
        logVerbose('ControlLoop', 'No task available in queue', { iteration });
      }
    }

    // Guard: skip tasks already in completed_tasks
    if (task && state.completed_tasks?.some(t => t.task_id === task!.task_id)) {
      logShared('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id} already completed, skipping`);
      task = null;
      taskSource = 'none';
    }

    // Guard: acquire task lock to prevent competing consumers
    if (task) {
      const locked = await this.acquireTaskLock(task.task_id);
      if (!locked) {
        logShared('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id} locked by another consumer, skipping`);
        task = null;
        taskSource = 'none';
      }
    }

    const taskRetrievalDuration = Date.now() - taskRetrievalStartTime;
    logPerformance('TaskRetrieval', taskRetrievalDuration, { iteration, source: taskSource, has_task: !!task });

    return {
      task,
      source: taskSource,
    };
  }
}
