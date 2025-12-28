// Queue Adapter - Simple Redis List implementation (no Lua scripts)
// Supervisor never generates tasks
// Queue is operator-controlled
// One task at a time, no reordering, no retries, no task mutation
// Compatible with DragonflyDB (no Lua required)

import { Task } from './types';
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

// QueueAdapter class for backward compatibility
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
