// Queue Service
// Reads queue length and contents from Redis List
import Redis from 'ioredis';
import { config } from '../config.js';

let queueClient: Redis | null = null;

/**
 * Get or create Redis client for queue
 */
function getQueueClient(): Redis {
  if (!queueClient) {
    queueClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.supervisor.queueDb,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 30000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    queueClient.on('error', (err) => {
      console.error('Queue Redis connection error:', err);
    });
  }
  return queueClient;
}

/**
 * Get queue key
 */
function getQueueKey(): string {
  return `queue:${config.supervisor.queueName}`;
}

/**
 * Get queue length
 */
export async function getQueueLength(): Promise<number> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    const length = await client.llen(key);
    return length;
  } catch (error) {
    console.error('Error getting queue length:', error);
    return 0;
  }
}

/**
 * Peek at queue contents (without dequeuing)
 * Returns up to limit items from the front of the queue
 */
export async function peekQueue(limit: number = 10): Promise<string[]> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    
    // Use LRANGE to peek at items without removing them
    const items = await client.lrange(key, 0, limit - 1);
    
    // Parse JSON if items are JSON strings
    return items.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  } catch (error) {
    console.error('Error peeking queue:', error);
    return [];
  }
}

/**
 * Enqueue a task
 */
export async function enqueueTask(task: any): Promise<void> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    const taskJson = JSON.stringify(task);
    await client.lpush(key, taskJson);
  } catch (error) {
    console.error('Error enqueuing task:', error);
    throw error;
  }
}

/**
 * Enqueue multiple tasks in bulk
 */
export async function enqueueTasks(tasks: any[]): Promise<void> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    const taskJsons = tasks.map(task => JSON.stringify(task));
    if (taskJsons.length > 0) {
      await client.lpush(key, ...taskJsons);
    }
  } catch (error) {
    console.error('Error enqueuing tasks in bulk:', error);
    throw error;
  }
}

/**
 * Get all pending tasks (for dump)
 */
export async function getAllPendingTasks(): Promise<any[]> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    const items = await client.lrange(key, 0, -1);
    
    return items.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return { error: 'Failed to parse task', raw: item };
      }
    });
  } catch (error) {
    console.error('Error getting all pending tasks:', error);
    return [];
  }
}

/**
 * Update a task in the queue
 * Warning: O(N) operation where N is queue length
 */
export async function updateTaskInQueue(taskId: string, updates: Record<string, any>): Promise<boolean> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    
    // We need to find the task first.
    // LPOS would be ideal but it returns index matching element, not partial match.
    // So we must fetch all (or scan). For simplicity/safety, fetch all.
    const items = await client.lrange(key, 0, -1);
    
    let foundIndex = -1;
    let foundTask: any = null;
    
    for (let i = 0; i < items.length; i++) {
      try {
        const task = JSON.parse(items[i]);
        if (task.task_id === taskId) {
          foundIndex = i;
          foundTask = task;
          break;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (foundIndex !== -1 && foundTask) {
      const updatedTask = { ...foundTask, ...updates };
      await client.lset(key, foundIndex, JSON.stringify(updatedTask));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating task in queue:', error);
    return false;
  }
}

/**
 * Remove a task from the queue (by ID)
 * Returns the removed task object if found
 */
export async function removeTaskFromQueue(taskId: string): Promise<any | null> {
  try {
    const client = getQueueClient();
    const key = getQueueKey();
    const items = await client.lrange(key, 0, -1);
    
    let foundTask: any = null;
    
    for (const item of items) {
      try {
        const task = JSON.parse(item);
        if (task.task_id === taskId) {
          foundTask = task;
          // Remove this specific item string
          // Count 1 means remove first occurrence (though there should be only one)
          // LREM is safe here
          await client.lrem(key, 1, item);
          break;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    return foundTask;
  } catch (error) {
    console.error('Error removing task from queue:', error);
    return null;
  }
}

/**
 * Close queue connection
 */
export async function closeConnection(): Promise<void> {
  if (queueClient) {
    await queueClient.quit();
    queueClient = null;
  }
}

