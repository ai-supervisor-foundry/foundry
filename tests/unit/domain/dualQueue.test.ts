import Redis from 'ioredis';
import { DualQueueAdapter } from '../../../src/domain/executors/taskQueue';
import { Task } from '../../../src/domain/types/types';
import { Provider } from '../../../src/domain/agents/enums/provider';

// Shared mock store — reset between tests
const store: Record<string, string[]> = {};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    lpush: jest.fn(async (key: string, value: string) => {
      if (!store[key]) store[key] = [];
      store[key].unshift(value);
      return store[key].length;
    }),
    rpop: jest.fn(async (key: string) => {
      if (!store[key] || store[key].length === 0) return null;
      return store[key].pop()!;
    }),
    llen: jest.fn(async (key: string) => (store[key] || []).length),
    lrange: jest.fn(async (key: string, start: number, stop: number) => {
      const list = store[key] || [];
      return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
    }),
    del: jest.fn(async (key: string) => { delete store[key]; return 1; }),
    pipeline: jest.fn(() => {
      const cmds: Array<() => void> = [];
      const p = {
        del: (key: string) => { cmds.push(() => { delete store[key]; }); return p; },
        lpush: (key: string, value: string) => { cmds.push(() => { if (!store[key]) store[key] = []; store[key].unshift(value); }); return p; },
        exec: async () => { cmds.forEach(fn => fn()); return []; },
      };
      return p;
    }),
    quit: jest.fn(),
  }));
});

function makeTask(overrides: Partial<Task> & { task_id: string }): Task {
  return {
    project_id: 'test-project',
    intent: 'test intent',
    tool: Provider.CURSOR,
    instructions: 'do something',
    acceptance_criteria: ['it works'],
    status: 'pending',
    affects_files: ['src/test.ts'],
    ...overrides,
  };
}

describe('DualQueueAdapter', () => {
  let adapter: DualQueueAdapter;

  beforeEach(() => {
    // Clear the store between tests
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    const client = new Redis();
    adapter = new DualQueueAdapter(client, 'test');
  });

  describe('enqueue classification', () => {
    it('sends tasks without depends_on to the ready queue', async () => {
      const task = makeTask({ task_id: 'task-1' });
      const result = await adapter.enqueue(task);

      expect(result).toBe('ready');
      expect(await adapter.readyCount()).toBe(1);
      expect(await adapter.waitingCount()).toBe(0);
    });

    it('sends tasks with empty depends_on to the ready queue', async () => {
      const task = makeTask({ task_id: 'task-2', depends_on: [] });
      const result = await adapter.enqueue(task);

      expect(result).toBe('ready');
      expect(await adapter.readyCount()).toBe(1);
      expect(await adapter.waitingCount()).toBe(0);
    });

    it('sends tasks with depends_on to the waiting queue', async () => {
      const task = makeTask({ task_id: 'task-3', depends_on: ['task-1'] });
      const result = await adapter.enqueue(task);

      expect(result).toBe('waiting');
      expect(await adapter.readyCount()).toBe(0);
      expect(await adapter.waitingCount()).toBe(1);
    });
  });

  describe('dequeueReady', () => {
    it('returns the first enqueued task (FIFO order)', async () => {
      const task1 = makeTask({ task_id: 'task-1' });
      const task2 = makeTask({ task_id: 'task-2' });
      await adapter.enqueue(task1);
      await adapter.enqueue(task2);

      const dequeued = await adapter.dequeueReady();
      expect(dequeued).not.toBeNull();
      expect(dequeued!.task_id).toBe('task-1');
    });

    it('returns null when the ready queue is empty', async () => {
      const result = await adapter.dequeueReady();
      expect(result).toBeNull();
    });

    it('removes the task from the ready queue after dequeue', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-1' }));

      expect(await adapter.readyCount()).toBe(1);
      await adapter.dequeueReady();
      expect(await adapter.readyCount()).toBe(0);
    });
  });

  describe('promoteReadyTasks', () => {
    it('promotes tasks whose dependencies are all completed', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-1' }));
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));

      const promoted = await adapter.promoteReadyTasks(['task-1']);

      expect(promoted).toHaveLength(1);
      expect(promoted[0].task_id).toBe('task-2');
      expect(await adapter.readyCount()).toBe(2); // original task-1 + promoted task-2
      expect(await adapter.waitingCount()).toBe(0);
    });

    it('does not promote tasks with unmet dependencies', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));

      const promoted = await adapter.promoteReadyTasks([]);

      expect(promoted).toHaveLength(0);
      expect(await adapter.waitingCount()).toBe(1);
      expect(await adapter.readyCount()).toBe(0);
    });

    it('partially promotes when only some tasks have met dependencies', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));
      await adapter.enqueue(makeTask({ task_id: 'task-3', depends_on: ['task-1', 'task-2'] }));

      const promoted = await adapter.promoteReadyTasks(['task-1']);

      expect(promoted).toHaveLength(1);
      expect(promoted[0].task_id).toBe('task-2');
      expect(await adapter.waitingCount()).toBe(1);
      expect(await adapter.readyCount()).toBe(1);
    });

    it('returns empty array when waiting queue is empty', async () => {
      const promoted = await adapter.promoteReadyTasks(['task-1']);
      expect(promoted).toHaveLength(0);
    });

    it('promotes multiple tasks at once when all deps are met', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));
      await adapter.enqueue(makeTask({ task_id: 'task-3', depends_on: ['task-1'] }));

      const promoted = await adapter.promoteReadyTasks(['task-1']);

      expect(promoted).toHaveLength(2);
      expect(await adapter.waitingCount()).toBe(0);
      expect(await adapter.readyCount()).toBe(2);
    });
  });

  describe('peek methods', () => {
    it('peekReady returns tasks without removing them', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-1' }));
      await adapter.enqueue(makeTask({ task_id: 'task-2' }));

      const peeked = await adapter.peekReady();
      expect(peeked).toHaveLength(2);

      // Tasks should still be in the queue
      expect(await adapter.readyCount()).toBe(2);
    });

    it('peekWaiting returns tasks without removing them', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));

      const peeked = await adapter.peekWaiting();
      expect(peeked).toHaveLength(1);
      expect(peeked[0].task_id).toBe('task-2');

      // Task should still be in the queue
      expect(await adapter.waitingCount()).toBe(1);
    });

    it('peekReady returns empty array when queue is empty', async () => {
      const peeked = await adapter.peekReady();
      expect(peeked).toHaveLength(0);
    });

    it('peekWaiting returns empty array when queue is empty', async () => {
      const peeked = await adapter.peekWaiting();
      expect(peeked).toHaveLength(0);
    });
  });

  describe('counts', () => {
    it('readyCount returns correct number', async () => {
      expect(await adapter.readyCount()).toBe(0);
      await adapter.enqueue(makeTask({ task_id: 'task-1' }));
      expect(await adapter.readyCount()).toBe(1);
      await adapter.enqueue(makeTask({ task_id: 'task-2' }));
      expect(await adapter.readyCount()).toBe(2);
    });

    it('waitingCount returns correct number', async () => {
      expect(await adapter.waitingCount()).toBe(0);
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));
      expect(await adapter.waitingCount()).toBe(1);
      await adapter.enqueue(makeTask({ task_id: 'task-3', depends_on: ['task-1'] }));
      expect(await adapter.waitingCount()).toBe(2);
    });

    it('counts reflect changes after dequeue', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-1' }));
      await adapter.enqueue(makeTask({ task_id: 'task-2' }));
      expect(await adapter.readyCount()).toBe(2);

      await adapter.dequeueReady();
      expect(await adapter.readyCount()).toBe(1);
    });

    it('counts reflect changes after promote', async () => {
      await adapter.enqueue(makeTask({ task_id: 'task-2', depends_on: ['task-1'] }));
      expect(await adapter.readyCount()).toBe(0);
      expect(await adapter.waitingCount()).toBe(1);

      await adapter.promoteReadyTasks(['task-1']);
      expect(await adapter.readyCount()).toBe(1);
      expect(await adapter.waitingCount()).toBe(0);
    });
  });
});
