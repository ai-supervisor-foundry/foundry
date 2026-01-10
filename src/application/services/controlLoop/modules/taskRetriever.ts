import { QueueAdapter } from '../../../../domain/executors/taskQueue';
import { SupervisorState, Task } from '../../../../domain/types/types';
import { log as logShared, logVerbose, logPerformance } from '../../../../infrastructure/adapters/logging/logger';

export interface TaskRetrievalResult {
  task: Task | null;
  source: 'current_task_recovery' | 'retry_task' | 'queue' | 'none';
}

export class TaskRetriever {
  constructor(private queue: QueueAdapter) {}

  async retrieveTask(state: SupervisorState, iteration: number): Promise<TaskRetrievalResult> {
    const taskRetrievalStartTime = Date.now();
    logVerbose('ControlLoop', 'Retrieving task', { iteration });
    
    let task: Task | null = null;
    let taskSource: TaskRetrievalResult['source'] = 'none';

    // 1. Recover interrupted task
    if (state.current_task) {
      task = state.current_task;
      taskSource = 'current_task_recovery';
      logShared('ControlLoop', `[Iteration ${iteration}] Recovering interrupted task: ${task.task_id}`);
      logVerbose('ControlLoop', 'Recovered interrupted task from state', {
        iteration,
        task_id: task.task_id,
        intent: task.intent,
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

    const taskRetrievalDuration = Date.now() - taskRetrievalStartTime;
    logPerformance('TaskRetrieval', taskRetrievalDuration, { iteration, source: taskSource, has_task: !!task });

    return {
      task,
      source: taskSource,
    };
  }
}
