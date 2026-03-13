// Lock Acquisition with Exponential Backoff
// Wraps FileLockManager.acquireAll with retry logic

import { FileLockManager } from '../../infrastructure/network/resilience/fileLockManager';
import { Task } from '../types/types';

export interface LockAcquisitionOptions {
  maxRetries: number;      // Max number of retry attempts (default: 10)
  initialDelayMs: number;  // First delay between retries (default: 100ms)
  maxDelayMs: number;      // Cap on delay between retries (default: 5000ms)
  timeoutMs: number;       // Total timeout for all attempts (default: 300000ms / 5 min)
}

const DEFAULT_OPTIONS: LockAcquisitionOptions = {
  maxRetries: 10,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  timeoutMs: 300000,
};

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [LockAcquisition] ${message}`, data ? JSON.stringify(data) : '');
}

/**
 * Attempt to acquire file locks with exponential backoff.
 * Returns true if locks acquired, false if timeout exceeded.
 */
export async function acquireLocksWithBackoff(
  lockManager: FileLockManager,
  task: Task,
  workerId: string,
  options: Partial<LockAcquisitionOptions> = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let attempt = 0;
  let delay = opts.initialDelayMs;

  while (attempt < opts.maxRetries) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= opts.timeoutMs) {
      log('Lock acquisition timed out', {
        taskId: task.task_id,
        workerId,
        attempts: attempt,
        elapsedMs: elapsed,
        timeoutMs: opts.timeoutMs,
      });
      return false;
    }

    const acquired = await lockManager.acquireAll(task.affects_files, task.task_id, workerId);
    if (acquired) {
      log('Locks acquired', {
        taskId: task.task_id,
        workerId,
        attempts: attempt + 1,
        elapsedMs: Date.now() - startTime,
      });
      return true;
    }

    attempt++;
    log('Lock contention, backing off', {
      taskId: task.task_id,
      workerId,
      attempt,
      delayMs: delay,
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, opts.maxDelayMs);
  }

  log('Lock acquisition exhausted retries', {
    taskId: task.task_id,
    workerId,
    attempts: attempt,
    elapsedMs: Date.now() - startTime,
  });
  return false;
}
