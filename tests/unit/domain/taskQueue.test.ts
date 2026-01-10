// Task Queue unit tests

import { enqueueTask, dequeueTask, getQueueKey } from '../../../src/domain/executors/taskQueue';
import { Task } from '../../../src/domain/types/types';
import { createMockTask } from '../../fixtures/mockData';
import Redis from 'ioredis';

describe('TaskQueue', () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      lpush: jest.fn().mockResolvedValue(1),
      rpop: jest.fn().mockResolvedValue(null as any),
      llen: jest.fn().mockResolvedValue(0),
    } as any;
  });

  describe('getQueueKey', () => {
    it('should format queue key correctly', () => {
      const key = getQueueKey('tasks');
      expect(key).toBe('queue:tasks');
    });

    it('should handle custom queue names', () => {
      const key = getQueueKey('custom-queue-123');
      expect(key).toBe('queue:custom-queue-123');
    });
  });

  describe('enqueueTask', () => {
    it('should enqueue a task to Redis', async () => {
      const task = createMockTask();
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.llen.mockResolvedValue(1);

      await enqueueTask(mockRedis, 'queue:tasks', task);

      expect(mockRedis.lpush).toHaveBeenCalledWith('queue:tasks', JSON.stringify(task));
      expect(mockRedis.llen).toHaveBeenCalledWith('queue:tasks');
    });

    it('should handle multiple enqueued tasks', async () => {
      const task1 = createMockTask({ task_id: 'task-1' });
      const task2 = createMockTask({ task_id: 'task-2' });

      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.llen.mockResolvedValue(2);

      await enqueueTask(mockRedis, 'queue:tasks', task1);
      expect(mockRedis.lpush).toHaveBeenCalledTimes(1);

      await enqueueTask(mockRedis, 'queue:tasks', task2);
      expect(mockRedis.lpush).toHaveBeenCalledTimes(2);
    });

    it('should preserve task data when enqueueing', async () => {
      const task = createMockTask({
        task_id: 'complex-task',
        instructions: 'Complex instructions with special chars: ${}[]',
        acceptance_criteria: ['Criteria 1', 'Criteria with "quotes"'],
      });

      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.llen.mockResolvedValue(1);

      await enqueueTask(mockRedis, 'queue:tasks', task);

      const callArgs = mockRedis.lpush.mock.calls[0];
      const enqueuedJson = callArgs[1] as string;
      const parsedTask = JSON.parse(enqueuedJson);

      expect(parsedTask).toEqual(task);
    });
  });

  describe('dequeueTask', () => {
    it('should dequeue a task from Redis', async () => {
      const task = createMockTask();
      mockRedis.rpop.mockResolvedValue(JSON.stringify(task) as any);
      mockRedis.llen.mockResolvedValue(0);

      const result = await dequeueTask(mockRedis, 'queue:tasks');

      expect(result).toEqual(task);
      expect(mockRedis.rpop).toHaveBeenCalledWith('queue:tasks');
    });

    it('should return null when queue is empty', async () => {
      mockRedis.rpop.mockResolvedValue(null as any);

      const result = await dequeueTask(mockRedis, 'queue:tasks');

      expect(result).toBeNull();
      expect(mockRedis.rpop).toHaveBeenCalledWith('queue:tasks');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockRedis.rpop.mockResolvedValue('invalid json' as any);

      expect(async () => {
        await dequeueTask(mockRedis, 'queue:tasks');
      }).rejects.toThrow();
    });

    it('should FIFO order with multiple tasks', async () => {
      const tasks = [
        createMockTask({ task_id: 'task-1' }),
        createMockTask({ task_id: 'task-2' }),
        createMockTask({ task_id: 'task-3' }),
      ];

      // Simulate FIFO: tasks pushed with LPUSH should be popped with RPOP in order
      mockRedis.rpop
        .mockResolvedValueOnce(JSON.stringify(tasks[0]) as any)
        .mockResolvedValueOnce(JSON.stringify(tasks[1]) as any)
        .mockResolvedValueOnce(JSON.stringify(tasks[2]) as any);

      mockRedis.llen.mockResolvedValue(3).mockResolvedValue(2).mockResolvedValue(1).mockResolvedValue(0);

      const result1 = await dequeueTask(mockRedis, 'queue:tasks');
      const result2 = await dequeueTask(mockRedis, 'queue:tasks');
      const result3 = await dequeueTask(mockRedis, 'queue:tasks');

      expect(result1?.task_id).toBe('task-1');
      expect(result2?.task_id).toBe('task-2');
      expect(result3?.task_id).toBe('task-3');
    });
  });
});
