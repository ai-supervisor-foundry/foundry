// Persistence Layer - DragonflyDB read/write only
// Single key, full overwrite only, no partial updates
// No Lua, no pubsub, no retries

import { SupervisorState } from './types';
import Redis from 'ioredis';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from './logger';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`Persistence:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[Persistence] ${operation}`, duration, metadata);
}

/**
 * Load state from DragonflyDB
 * GET must exist, else throw
 * JSON parse failure throws
 */
export async function loadState(
  client: Redis,
  stateKey: string
): Promise<SupervisorState> {
  const startTime = Date.now();
  logVerbose('LoadState', 'Loading state from DragonflyDB', { state_key: stateKey });
  
  // Single GET operation
  const getStartTime = Date.now();
  const rawValue = await client.get(stateKey);
  const getDuration = Date.now() - getStartTime;
  logPerformance('RedisGET', getDuration, { state_key: stateKey, found: rawValue !== null });
  logVerbose('LoadState', 'GET operation completed', {
    state_key: stateKey,
    raw_value_size: rawValue?.length || 0,
    found: rawValue !== null,
  });
  
  // GET must exist, else throw
  if (rawValue === null) {
    logVerbose('LoadState', 'State key not found', { state_key: stateKey });
    throw new Error(`State key ${stateKey} not found`);
  }

  // JSON parse failure throws
  const parseStartTime = Date.now();
  try {
    const parsed = JSON.parse(rawValue) as SupervisorState;
    const parseDuration = Date.now() - parseStartTime;
    logPerformance('StateJSONParse', parseDuration, {
      state_key: stateKey,
      raw_size: rawValue.length,
      parsed_size: JSON.stringify(parsed).length,
    });
    logVerbose('LoadState', 'State parsed successfully', {
      state_key: stateKey,
      status: parsed.supervisor.status,
      iteration: parsed.supervisor.iteration,
      execution_mode: parsed.execution_mode,
      goal_completed: parsed.goal.completed,
      queue_exhausted: parsed.queue.exhausted,
      completed_tasks_count: parsed.completed_tasks?.length || 0,
    });
    
    const totalDuration = Date.now() - startTime;
    logPerformance('LoadState', totalDuration, { state_key: stateKey });
    return parsed;
  } catch (error) {
    const parseDuration = Date.now() - parseStartTime;
    logPerformance('StateJSONParse', parseDuration, { state_key: stateKey, failed: true });
    logVerbose('LoadState', 'JSON parse failed', {
      state_key: stateKey,
      error: error instanceof Error ? error.message : String(error),
      raw_value_preview: rawValue.substring(0, 200),
    });
    if (error instanceof SyntaxError) {
      throw new Error(`JSON parse failure for state key ${stateKey}: ${error.message}`);
    }
    throw new Error(`Failed to parse state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Persist state to DragonflyDB
 * SET overwrites entire value
 * Any failure must surface to caller
 */
export async function persistState(
  client: Redis,
  stateKey: string,
  state: SupervisorState
): Promise<void> {
  const startTime = Date.now();
  logVerbose('PersistState', 'Persisting state to DragonflyDB', {
    state_key: stateKey,
    status: state.supervisor.status,
    iteration: state.supervisor.iteration,
  });
  
  // Update last_updated timestamp
  const previousLastUpdated = state.last_updated;
  state.last_updated = new Date().toISOString();
  logVerbose('PersistState', 'Updated last_updated timestamp', {
    state_key: stateKey,
    previous: previousLastUpdated,
    new: state.last_updated,
  });

  // Serialize to JSON
  const serializeStartTime = Date.now();
  let serialized: string;
  try {
    serialized = JSON.stringify(state);
    const serializeDuration = Date.now() - serializeStartTime;
    logPerformance('StateJSONSerialize', serializeDuration, {
      state_key: stateKey,
      serialized_size: serialized.length,
    });
    logVerbose('PersistState', 'State serialized', {
      state_key: stateKey,
      serialized_size: serialized.length,
      status: state.supervisor.status,
      iteration: state.supervisor.iteration,
    });
  } catch (error) {
    const serializeDuration = Date.now() - serializeStartTime;
    logPerformance('StateJSONSerialize', serializeDuration, { state_key: stateKey, failed: true });
    logVerbose('PersistState', 'Serialization failed', {
      state_key: stateKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to serialize state: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Single SET operation - full overwrite
  // Any failure must surface to caller
  const setStartTime = Date.now();
  try {
    await client.set(stateKey, serialized);
    const setDuration = Date.now() - setStartTime;
    logPerformance('RedisSET', setDuration, {
      state_key: stateKey,
      value_size: serialized.length,
    });
    logVerbose('PersistState', 'State persisted successfully', {
      state_key: stateKey,
      serialized_size: serialized.length,
    });
  } catch (error) {
    const setDuration = Date.now() - setStartTime;
    logPerformance('RedisSET', setDuration, { state_key: stateKey, failed: true });
    logVerbose('PersistState', 'SET operation failed', {
      state_key: stateKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to persist state to key ${stateKey}: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  const totalDuration = Date.now() - startTime;
  logPerformance('PersistState', totalDuration, { state_key: stateKey });
}

// Legacy PersistenceLayer class for backward compatibility
export class PersistenceLayer {
  constructor(
    private client: Redis,
    private stateKey: string // Operator-defined, fixed key name
  ) {
    logVerbose('PersistenceLayer', 'PersistenceLayer initialized', { state_key: this.stateKey });
  }

  async readState(): Promise<SupervisorState> {
    logVerbose('PersistenceLayer', 'readState called', { state_key: this.stateKey });
    return loadState(this.client, this.stateKey);
  }

  async writeState(state: SupervisorState): Promise<void> {
    logVerbose('PersistenceLayer', 'writeState called', {
      state_key: this.stateKey,
      status: state.supervisor.status,
      iteration: state.supervisor.iteration,
    });
    return persistState(this.client, this.stateKey, state);
  }
}
