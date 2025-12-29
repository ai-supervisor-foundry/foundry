import Redis from 'ioredis';
import { loadState, persistState } from '../src/persistence';
import { enqueueTask, getQueueKey } from '../src/queue';
import { SupervisorState } from '../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';

async function unblockTasks() {
  console.log('[UNBLOCK] Starting unblock script...');
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6499');
  const stateKey = process.env.STATE_KEY || 'supervisor:state';
  const queueName = process.env.QUEUE_NAME || 'tasks';
  const queueDb = parseInt(process.env.QUEUE_DB || '2');
  const stateDb = parseInt(process.env.STATE_DB || '0');
  
  console.log(`[UNBLOCK] Configuration:`, { redisHost, redisPort, stateKey, queueName, queueDb, stateDb });
  
  console.log(`[UNBLOCK] Creating Redis clients...`);
  const stateClient = new Redis({ 
    host: redisHost, 
    port: redisPort, 
    db: stateDb,
    connectTimeout: 5000,
    retryStrategy: () => null // Don't retry on connection failure
  });
  const queueClient = new Redis({ 
    host: redisHost, 
    port: redisPort, 
    db: queueDb,
    connectTimeout: 5000,
    retryStrategy: () => null
  });
  
  console.log(`[UNBLOCK] Testing Redis connections...`);
  try {
    const statePing = await Promise.race([
      stateClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('State client ping timeout')), 5000))
    ]);
    console.log(`[UNBLOCK] ✅ State client connected: ${statePing}`);
    
    const queuePing = await Promise.race([
      queueClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Queue client ping timeout')), 5000))
    ]);
    console.log(`[UNBLOCK] ✅ Queue client connected: ${queuePing}`);
  } catch (error) {
    console.error(`[UNBLOCK] ❌ Redis connection failed:`, error instanceof Error ? error.message : String(error));
    await stateClient.quit().catch(() => {});
    await queueClient.quit().catch(() => {});
    throw error;
  }
  
  console.log(`[UNBLOCK] Loading state from ${stateKey}...`);
  const loadStart = Date.now();
  let state;
  try {
    state = await Promise.race([
      loadState(stateClient, stateKey),
      new Promise((_, reject) => setTimeout(() => reject(new Error('loadState timeout after 10s')), 10000))
    ]);
    const loadDuration = Date.now() - loadStart;
    console.log(`[UNBLOCK] ✅ State loaded in ${loadDuration}ms`);
  } catch (error) {
    console.error(`[UNBLOCK] ❌ Failed to load state:`, error instanceof Error ? error.message : String(error));
    await stateClient.quit().catch(() => {});
    await queueClient.quit().catch(() => {});
    throw error;
  }
  
  console.log(`[UNBLOCK] Checking blocked tasks...`);
  if (!state.blocked_tasks || state.blocked_tasks.length === 0) {
    console.log('[UNBLOCK] No blocked tasks found.');
    await stateClient.quit().catch(() => {});
    await queueClient.quit().catch(() => {});
    return;
  }
  
  console.log(`[UNBLOCK] Found ${state.blocked_tasks.length} blocked tasks:`, state.blocked_tasks.map((bt: any) => bt.task_id).join(', '));
  
  // Tasks to unblock - if empty array, unblock all blocked tasks
  // Otherwise, only unblock tasks in this list
  const tasksToUnblock: string[] = [];
  
  // If no specific tasks provided, unblock all blocked tasks
  if (tasksToUnblock.length === 0 && state.blocked_tasks && state.blocked_tasks.length > 0) {
    tasksToUnblock.push(...state.blocked_tasks.map((bt: any) => bt.task_id));
    console.log(`[UNBLOCK] No specific tasks provided, will unblock all ${tasksToUnblock.length} blocked tasks`);
  }
  
  // Load tasks.json to get full task definitions
  console.log(`[UNBLOCK] Loading tasks.json...`);
  const tasksJsonPath = path.join(process.cwd(), 'tasks', 'tasks.json');
  let tasksJson;
  try {
    const tasksJsonContent = await fs.readFile(tasksJsonPath, 'utf8');
    tasksJson = JSON.parse(tasksJsonContent);
    console.log(`[UNBLOCK] ✅ Loaded ${tasksJson.length} tasks from tasks.json`);
  } catch (error) {
    console.error(`[UNBLOCK] ❌ Failed to load tasks.json:`, error instanceof Error ? error.message : String(error));
    await stateClient.quit().catch(() => {});
    await queueClient.quit().catch(() => {});
    throw error;
  }
  const tasksMap = new Map(tasksJson.map((t: any) => [t.task_id, t]));
  
  // Remove tasks from blocked_tasks and re-enqueue
  console.log(`[UNBLOCK] Processing ${tasksToUnblock.length} tasks to unblock...`);
  const unblocked: string[] = [];
  const notFound: string[] = [];
  
  for (const taskId of tasksToUnblock) {
    console.log(`[UNBLOCK] Processing task: ${taskId}`);
    const taskIndex = state.blocked_tasks?.findIndex((bt: any) => bt.task_id === taskId);
    if (taskIndex !== undefined && taskIndex >= 0) {
      console.log(`[UNBLOCK] Task ${taskId} found in blocked list at index ${taskIndex}`);
      // Remove from blocked_tasks
      state.blocked_tasks.splice(taskIndex, 1);
      
      // Get full task definition
      const task = tasksMap.get(taskId);
      if (task) {
        console.log(`[UNBLOCK] Task definition found for ${taskId}, setting status to pending...`);
        // Ensure status is set to pending (blocked tasks should never be autocompleted)
        task.status = 'pending';
        // Re-enqueue
        console.log(`[UNBLOCK] Enqueuing task ${taskId}...`);
        try {
          const queueKey = getQueueKey(queueName);
          console.log(`[UNBLOCK] Using queue key: ${queueKey}`);
          await Promise.race([
            enqueueTask(queueClient, queueKey, task),
            new Promise((_, reject) => setTimeout(() => reject(new Error('enqueueTask timeout after 5s')), 5000))
          ]);
          unblocked.push(taskId);
          console.log(`[UNBLOCK] ✅ Unblocked and re-enqueued: ${taskId} (status: pending)`);
        } catch (error) {
          console.error(`[UNBLOCK] ❌ Failed to enqueue ${taskId}:`, error instanceof Error ? error.message : String(error));
          throw error;
        }
      } else {
        notFound.push(taskId);
        console.log(`[UNBLOCK] ⚠️ Task definition not found in tasks.json: ${taskId}`);
      }
    } else {
      console.log(`[UNBLOCK] ℹ️ Task not in blocked list: ${taskId}`);
    }
  }
  
  // Persist updated state
  console.log(`[UNBLOCK] Persisting updated state...`);
  try {
    state.last_updated = new Date().toISOString();
    await Promise.race([
      persistState(stateClient, stateKey, state),
      new Promise((_, reject) => setTimeout(() => reject(new Error('persistState timeout after 5s')), 5000))
    ]);
    console.log(`[UNBLOCK] ✅ State persisted successfully`);
  } catch (error) {
    console.error(`[UNBLOCK] ❌ Failed to persist state:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
  
  console.log(`[UNBLOCK] \nSummary:`);
  console.log(`[UNBLOCK] - Unblocked and re-enqueued: ${unblocked.length} tasks`);
  if (notFound.length > 0) {
    console.log(`[UNBLOCK] - Task definitions not found: ${notFound.join(', ')}`);
  }
  
  console.log(`[UNBLOCK] Closing Redis connections...`);
  await stateClient.quit().catch(() => {});
  await queueClient.quit().catch(() => {});
  console.log(`[UNBLOCK] ✅ Script completed successfully`);
}

unblockTasks().catch(console.error);
