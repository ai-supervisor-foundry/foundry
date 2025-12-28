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
 * Close queue connection
 */
export async function closeConnection(): Promise<void> {
  if (queueClient) {
    await queueClient.quit();
    queueClient = null;
  }
}

