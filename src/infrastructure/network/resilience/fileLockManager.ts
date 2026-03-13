// File Lock Manager — Redis-based distributed file locking for parallel execution
// Uses SETNX + TTL for atomic lock acquisition (no Lua required, DragonflyDB compatible)

import Redis from 'ioredis';
import { FileLock } from '../../../domain/types/types';

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FileLockManager] ${message}`, data ? JSON.stringify(data) : '');
}

export class FileLockManager {
  constructor(
    private client: Redis,
    private ttlSeconds: number = 2100 // 35 min default (> 30 min task timeout)
  ) {}

  /**
   * Generate lock key for a file path.
   */
  private lockKey(filePath: string): string {
    return `filelock:${filePath}`;
  }

  /**
   * Acquire locks for all files atomically (all-or-nothing).
   * If any lock fails, releases all already-acquired locks and returns false.
   */
  async acquireAll(files: string[], taskId: string, workerId: string): Promise<boolean> {
    const acquired: string[] = [];
    const lockValue: FileLock = {
      file_path: '',
      task_id: taskId,
      worker_id: workerId,
      acquired_at: new Date().toISOString(),
    };

    for (const file of files) {
      const key = this.lockKey(file);
      const value = JSON.stringify({ ...lockValue, file_path: file });

      // SET key value NX EX ttl — atomic SETNX + TTL
      const result = await this.client.set(key, value, 'EX', this.ttlSeconds, 'NX');

      if (result === 'OK') {
        acquired.push(file);
      } else {
        // Lock contention — release all already-acquired and return false
        log('Lock contention', { file, taskId, workerId, acquired_count: acquired.length });
        for (const acqFile of acquired) {
          await this.client.del(this.lockKey(acqFile));
        }
        return false;
      }
    }

    log('All locks acquired', { taskId, workerId, file_count: files.length });
    return true;
  }

  /**
   * Release all locks held by a specific task.
   * Scans filelock:* keys and deletes those matching the taskId.
   */
  async releaseAll(taskId: string): Promise<number> {
    let released = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor, 'MATCH', 'filelock:*', 'COUNT', 100
      );
      cursor = nextCursor;

      for (const key of keys) {
        const value = await this.client.get(key);
        if (value) {
          try {
            const lock: FileLock = JSON.parse(value);
            if (lock.task_id === taskId) {
              await this.client.del(key);
              released++;
            }
          } catch {
            // Corrupted lock data — delete it
            await this.client.del(key);
            released++;
          }
        }
      }
    } while (cursor !== '0');

    if (released > 0) {
      log('Locks released', { taskId, released });
    }
    return released;
  }

  /**
   * Check if a specific file is locked.
   */
  async isLocked(filePath: string): Promise<FileLock | null> {
    const value = await this.client.get(this.lockKey(filePath));
    if (!value) return null;
    try {
      return JSON.parse(value) as FileLock;
    } catch {
      return null;
    }
  }

  /**
   * Get all active file locks.
   */
  async getAllLocks(): Promise<Record<string, FileLock>> {
    const locks: Record<string, FileLock> = {};
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor, 'MATCH', 'filelock:*', 'COUNT', 100
      );
      cursor = nextCursor;

      for (const key of keys) {
        const value = await this.client.get(key);
        if (value) {
          try {
            const lock: FileLock = JSON.parse(value);
            locks[lock.file_path] = lock;
          } catch {
            // Skip corrupted entries
          }
        }
      }
    } while (cursor !== '0');

    return locks;
  }
}
