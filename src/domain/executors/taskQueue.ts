// Queue Adapter - Simple Redis List implementation (no Lua scripts)
// Supervisor never generates tasks
// Queue is operator-controlled
// One task at a time, no reordering, no retries, no task mutation
// Compatible with DragonflyDB (no Lua required)

import { Task } from '../types/types';
import Redis from 'ioredis';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Queue] ${message}`, ...args);
}

/**
 * Enqueue a task to Redis List
 * No task mutation
 * Uses LPUSH for FIFO queue (RPOP for dequeue)
 */
export async function enqueueTask(
  client: Redis,
  queueKey: string,
  task: Task
): Promise<void> {
  log(`Enqueuing task: ${task.task_id} to queue: ${queueKey}`);
  // Serialize task to JSON
  const taskJson = JSON.stringify(task);
  
  // Push to left side of list (FIFO: first in, first out)
  // We'll pop from right side (RPOP)
  await client.lpush(queueKey, taskJson);
  const queueLength = await client.llen(queueKey);
  log(`Task ${task.task_id} enqueued, queue length: ${queueLength}`);
}

/**
 * Dequeue exactly one task from Redis List
 * Returns null if no task available
 * No reordering
 * Uses RPOP for atomic dequeue
 */
export async function dequeueTask(
  client: Redis,
  queueKey: string
): Promise<Task | null> {
  log(`Attempting to dequeue from queue: ${queueKey}`);
  // Pop from right side of list (FIFO: first in, first out)
  // RPOP is atomic - only one consumer gets the task
  const taskJson = await client.rpop(queueKey);
  
  if (!taskJson) {
    log(`No task available in queue: ${queueKey}`);
    return null;
  }

  // Parse and return task (no mutation)
  const task: Task = JSON.parse(taskJson);
  const queueLength = await client.llen(queueKey);
  log(`Dequeued task: ${task.task_id}, remaining in queue: ${queueLength}`);
  return task;
}

/**
 * Create Redis client for queue
 * Backed by DragonflyDB (Redis-compatible)
 * DB index != supervisor state DB
 */
export function createQueue(
  queueName: string,
  host: string,
  port: number,
  dbIndex: number
): Redis {
  // Create Redis client with DragonflyDB connection
  // Use different DB index than supervisor state
  const client = new Redis({
    host,
    port,
    db: dbIndex, // Different DB index from supervisor state
  });

  return client;
}

/**
 * Get queue key name
 */
export function getQueueKey(queueName: string): string {
  return `queue:${queueName}`;
}

// QueueAdapter class for backward compatibility (sequential mode)
export class QueueAdapter {
  private queueKey: string;

  constructor(
    private client: Redis,
    queueName: string
  ) {
    this.queueKey = getQueueKey(queueName);
  }

  async dequeue(): Promise<Task | null> {
    return dequeueTask(this.client, this.queueKey);
  }

  async enqueue(task: Task): Promise<void> {
    return enqueueTask(this.client, this.queueKey, task);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Dual Queue Adapter — ready/waiting queues with dependency resolution.
 * Ready queue: tasks with no unmet dependencies (immediately dispatchable).
 * Waiting queue: tasks with depends_on that haven't completed yet.
 * Both use Redis Lists (LPUSH/RPOP for FIFO).
 */
export class DualQueueAdapter {
  private readyKey: string;
  private waitingKey: string;

  constructor(
    private client: Redis,
    queueName: string
  ) {
    this.readyKey = `queue:${queueName}:ready`;
    this.waitingKey = `queue:${queueName}:waiting`;
  }

  /**
   * Enqueue a task — auto-classifies to ready or waiting based on depends_on.
   */
  async enqueue(task: Task): Promise<'ready' | 'waiting'> {
    const taskJson = JSON.stringify(task);
    if (task.depends_on && task.depends_on.length > 0) {
      await this.client.lpush(this.waitingKey, taskJson);
      const len = await this.client.llen(this.waitingKey);
      log(`Task ${task.task_id} enqueued to WAITING (deps: ${task.depends_on.join(', ')}), waiting queue length: ${len}`);
      return 'waiting';
    } else {
      await this.client.lpush(this.readyKey, taskJson);
      const len = await this.client.llen(this.readyKey);
      log(`Task ${task.task_id} enqueued to READY, ready queue length: ${len}`);
      return 'ready';
    }
  }

  /**
   * Dequeue one task from the ready queue (FIFO).
   */
  async dequeueReady(): Promise<Task | null> {
    const taskJson = await this.client.rpop(this.readyKey);
    if (!taskJson) {
      return null;
    }
    const task: Task = JSON.parse(taskJson);
    log(`Dequeued ready task: ${task.task_id}`);
    return task;
  }

  /**
   * Promote eligible tasks from waiting → ready.
   * A task is eligible when all its depends_on task_ids are in completedTaskIds.
   * Returns the tasks that were promoted.
   */
  async promoteReadyTasks(completedTaskIds: string[]): Promise<Task[]> {
    const completedSet = new Set(completedTaskIds);
    const waitingLen = await this.client.llen(this.waitingKey);
    if (waitingLen === 0) return [];

    // Read all waiting tasks
    const waitingJsons = await this.client.lrange(this.waitingKey, 0, -1);
    const promoted: Task[] = [];
    const stillWaiting: Task[] = [];

    for (const json of waitingJsons) {
      const task: Task = JSON.parse(json);
      const allDepsMet = task.depends_on?.every(dep => completedSet.has(dep)) ?? true;
      if (allDepsMet) {
        promoted.push(task);
      } else {
        stillWaiting.push(task);
      }
    }

    if (promoted.length === 0) return [];

    // Rebuild waiting queue with only still-waiting tasks
    // Use pipeline for atomicity
    const pipeline = this.client.pipeline();
    pipeline.del(this.waitingKey);
    for (const task of stillWaiting) {
      pipeline.lpush(this.waitingKey, JSON.stringify(task));
    }
    // Push promoted tasks to ready queue
    for (const task of promoted) {
      pipeline.lpush(this.readyKey, JSON.stringify(task));
    }
    await pipeline.exec();

    for (const task of promoted) {
      log(`Promoted task ${task.task_id} from WAITING → READY`);
    }

    return promoted;
  }

  /**
   * Peek into the waiting queue without removing.
   */
  async peekWaiting(): Promise<Task[]> {
    const items = await this.client.lrange(this.waitingKey, 0, -1);
    return items.map(json => JSON.parse(json));
  }

  /**
   * Peek into the ready queue without removing.
   */
  async peekReady(): Promise<Task[]> {
    const items = await this.client.lrange(this.readyKey, 0, -1);
    return items.map(json => JSON.parse(json));
  }

  async readyCount(): Promise<number> {
    return this.client.llen(this.readyKey);
  }

  async waitingCount(): Promise<number> {
    return this.client.llen(this.waitingKey);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
