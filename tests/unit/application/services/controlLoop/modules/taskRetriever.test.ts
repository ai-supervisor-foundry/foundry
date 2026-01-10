import { TaskRetriever } from '../../../../../../src/application/services/controlLoop/modules/taskRetriever';
import { QueueAdapter } from '../../../../../../src/domain/executors/taskQueue';
import { SupervisorState, Task } from '../../../../../../src/domain/types/types';

describe('TaskRetriever', () => {
  let mockQueue: jest.Mocked<QueueAdapter>;
  let taskRetriever: TaskRetriever;

  beforeEach(() => {
    mockQueue = {
      dequeue: jest.fn(),
    } as any;
    taskRetriever = new TaskRetriever(mockQueue);
  });

  it('should recover current_task if present', async () => {
    const task = { task_id: 't1' } as Task;
    const state = { current_task: task } as SupervisorState;

    const result = await taskRetriever.retrieveTask(state, 1);
    
    expect(result.task).toBe(task);
    expect(result.source).toBe('current_task_recovery');
    expect(mockQueue.dequeue).not.toHaveBeenCalled();
  });

  it('should recover retry_task if present', async () => {
    const task = { task_id: 't1' } as Task;
    const state = { supervisor: { retry_task: task } } as unknown as SupervisorState;

    const result = await taskRetriever.retrieveTask(state, 1);
    
    expect(result.task).toBe(task);
    expect(result.source).toBe('retry_task');
    expect((state.supervisor as any).retry_task).toBeUndefined(); // Should clear it
  });

  it('should dequeue from queue if no recovery task', async () => {
    const task = { task_id: 't1' } as Task;
    mockQueue.dequeue.mockResolvedValue(task);
    const state = { supervisor: {} } as SupervisorState;

    const result = await taskRetriever.retrieveTask(state, 1);
    
    expect(result.task).toBe(task);
    expect(result.source).toBe('queue');
  });
});
