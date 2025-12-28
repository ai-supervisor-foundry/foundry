// Supervisor State Service
// Connects to DragonflyDB and reads supervisor state
import Redis from 'ioredis';
import { config } from '../config.js';

// Import types from supervisor (we'll need to reference these)
// For now, define a minimal interface
export interface SupervisorState {
  supervisor: {
    status: 'RUNNING' | 'BLOCKED' | 'HALTED' | 'COMPLETED';
    iteration?: number;
    last_task_id?: string;
    last_validation_report?: unknown;
    halt_reason?: string;
    halt_details?: string;
  };
  goal: {
    description: string;
    completed: boolean;
    project_id?: string;
  };
  constraints?: Record<string, unknown>;
  current_task?: unknown;
  completed_tasks?: unknown[];
  blocked_tasks?: unknown[];
  decisions?: unknown[];
  artifacts?: unknown[];
  queue: {
    exhausted: boolean;
  };
  last_updated: string;
  execution_mode: 'AUTO' | 'MANUAL';
}

let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.supervisor.stateDb,
      retryStrategy: (times) => {
        // Exponential backoff, max 30s
        const delay = Math.min(times * 50, 30000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });
  }
  return redisClient;
}

/**
 * Load supervisor state from DragonflyDB
 * Handles connection errors gracefully
 */
export async function loadSupervisorState(): Promise<SupervisorState | null> {
  try {
    const client = getRedisClient();
    const rawValue = await client.get(config.supervisor.stateKey);
    
    if (rawValue === null) {
      return null;
    }

    const state = JSON.parse(rawValue) as SupervisorState;
    return state;
  } catch (error) {
    console.error('Error loading supervisor state:', error);
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in state: ${error.message}`);
    }
    if (error instanceof Error) {
      throw new Error(`Failed to load state: ${error.message}`);
    }
    throw new Error('Failed to load state: Unknown error');
  }
}

/**
 * Get supervisor status only
 */
export async function getSupervisorStatus(): Promise<{
  status: SupervisorState['supervisor']['status'] | null;
  error?: string;
}> {
  try {
    const state = await loadSupervisorState();
    if (!state) {
      return { status: null };
    }
    return { status: state.supervisor.status };
  } catch (error) {
    return {
      status: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current task
 */
export async function getCurrentTask(): Promise<unknown | null> {
  try {
    const state = await loadSupervisorState();
    return state?.current_task || null;
  } catch (error) {
    console.error('Error getting current task:', error);
    return null;
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

