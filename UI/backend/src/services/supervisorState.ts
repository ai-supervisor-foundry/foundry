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
 * Save supervisor state to DragonflyDB
 */
export async function saveSupervisorState(state: SupervisorState): Promise<void> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(state);
    await client.set(config.supervisor.stateKey, serialized);
  } catch (error) {
    console.error('Error saving supervisor state:', error);
    throw new Error('Failed to save state');
  }
}

/**
 * Update a task in the supervisor state (completed or blocked)
 */
export async function updateTaskInState(taskId: string, updates: Record<string, any>): Promise<boolean> {
  const state = await loadSupervisorState();
  if (!state) return false;
  
  let found = false;

  // Check completed tasks
  if (state.completed_tasks) {
    const index = state.completed_tasks.findIndex((t: any) => t.task_id === taskId);
    if (index !== -1) {
      state.completed_tasks[index] = { ...(state.completed_tasks[index] as object), ...updates };
      found = true;
    }
  }

  // Check blocked tasks
  if (!found && state.blocked_tasks) {
    const index = state.blocked_tasks.findIndex((t: any) => t.task_id === taskId);
    if (index !== -1) {
      state.blocked_tasks[index] = { ...(state.blocked_tasks[index] as object), ...updates };
      found = true;
    }
  }
  
  // Also check if it's the current task (though usually read-only)
  if (!found && (state as any).current_task && (state as any).current_task.task_id === taskId) {
      (state as any).current_task = { ...(state as any).current_task, ...updates };
      found = true;
  }

  if (found) {
    await saveSupervisorState(state);
    return true;
  }
  
  return false;
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

