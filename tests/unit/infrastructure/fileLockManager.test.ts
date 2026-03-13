import Redis from 'ioredis';
import { FileLock } from '../../../src/domain/types/types';
import { FileLockManager } from '../../../src/infrastructure/network/resilience/fileLockManager';

// Module-level store shared between mock methods
const store: Record<string, { value: string; ttl: number }> = {};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(async (key: string, value: string, ex?: string, ttl?: number, nx?: string) => {
      if (nx === 'NX' && store[key]) return null;
      store[key] = { value, ttl: ttl || 0 };
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store[key]?.value || null),
    del: jest.fn(async (key: string) => {
      const existed = !!store[key];
      delete store[key];
      return existed ? 1 : 0;
    }),
    scan: jest.fn(async (cursor: string, ...args: any[]) => {
      const matchIdx = args.indexOf('MATCH');
      const pattern = matchIdx >= 0 ? args[matchIdx + 1] : '*';
      const prefix = pattern.replace('*', '');
      const keys = Object.keys(store).filter(k => k.startsWith(prefix));
      return ['0', keys];
    }),
    quit: jest.fn(),
  }));
});

describe('FileLockManager', () => {
  let manager: FileLockManager;
  let client: Redis;

  beforeEach(() => {
    // Clear the store between tests
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    client = new Redis();
    manager = new FileLockManager(client);
  });

  describe('acquireAll', () => {
    it('should acquire locks for all files and return true', async () => {
      const files = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
      const result = await manager.acquireAll(files, 'task-1', 'worker-1');

      expect(result).toBe(true);
      // Verify all keys exist in the store
      for (const file of files) {
        const key = `filelock:${file}`;
        expect(store[key]).toBeDefined();
        const lock: FileLock = JSON.parse(store[key].value);
        expect(lock.task_id).toBe('task-1');
        expect(lock.worker_id).toBe('worker-1');
        expect(lock.file_path).toBe(file);
      }
    });

    it('should release all acquired locks and return false on contention', async () => {
      // Pre-lock the second file so contention occurs
      const contestedFile = 'src/b.ts';
      store[`filelock:${contestedFile}`] = {
        value: JSON.stringify({
          file_path: contestedFile,
          task_id: 'other-task',
          worker_id: 'other-worker',
          acquired_at: new Date().toISOString(),
        }),
        ttl: 2100,
      };

      const files = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
      const result = await manager.acquireAll(files, 'task-1', 'worker-1');

      expect(result).toBe(false);
      // The first file (a.ts) should have been rolled back
      expect(store['filelock:src/a.ts']).toBeUndefined();
      // The contested lock should remain untouched
      const remaining: FileLock = JSON.parse(store[`filelock:${contestedFile}`].value);
      expect(remaining.task_id).toBe('other-task');
      // The third file should never have been attempted
      expect(store['filelock:src/c.ts']).toBeUndefined();
    });
  });

  describe('releaseAll', () => {
    it('should release all locks belonging to a specific taskId', async () => {
      // Acquire locks for two different tasks
      await manager.acquireAll(['src/a.ts', 'src/b.ts'], 'task-1', 'worker-1');
      await manager.acquireAll(['src/c.ts'], 'task-2', 'worker-2');

      const released = await manager.releaseAll('task-1');

      expect(released).toBe(2);
      expect(store['filelock:src/a.ts']).toBeUndefined();
      expect(store['filelock:src/b.ts']).toBeUndefined();
      // task-2 lock should remain
      expect(store['filelock:src/c.ts']).toBeDefined();
    });

    it('should return 0 when no locks match the taskId', async () => {
      await manager.acquireAll(['src/a.ts'], 'task-1', 'worker-1');

      const released = await manager.releaseAll('nonexistent-task');

      expect(released).toBe(0);
      // Original lock untouched
      expect(store['filelock:src/a.ts']).toBeDefined();
    });
  });

  describe('isLocked', () => {
    it('should return the FileLock if the file is locked', async () => {
      await manager.acquireAll(['src/a.ts'], 'task-1', 'worker-1');

      const lock = await manager.isLocked('src/a.ts');

      expect(lock).not.toBeNull();
      expect(lock!.task_id).toBe('task-1');
      expect(lock!.worker_id).toBe('worker-1');
      expect(lock!.file_path).toBe('src/a.ts');
      expect(lock!.acquired_at).toBeDefined();
    });

    it('should return null if the file is not locked', async () => {
      const lock = await manager.isLocked('src/nonexistent.ts');

      expect(lock).toBeNull();
    });
  });

  describe('getAllLocks', () => {
    it('should return all active locks keyed by file path', async () => {
      await manager.acquireAll(['src/a.ts'], 'task-1', 'worker-1');
      await manager.acquireAll(['src/b.ts'], 'task-2', 'worker-2');

      const locks = await manager.getAllLocks();

      expect(Object.keys(locks)).toHaveLength(2);
      expect(locks['src/a.ts'].task_id).toBe('task-1');
      expect(locks['src/b.ts'].task_id).toBe('task-2');
    });

    it('should return an empty object when no locks exist', async () => {
      const locks = await manager.getAllLocks();

      expect(locks).toEqual({});
    });
  });
});
