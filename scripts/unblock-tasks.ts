import Redis from 'ioredis';
import { loadState, persistState } from '../src/persistence';
import { enqueueTask } from '../src/queue';
import { SupervisorState } from '../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';

async function unblockTasks() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6499');
  const stateKey = process.env.STATE_KEY || 'supervisor:state';
  const queueName = process.env.QUEUE_NAME || 'tasks';
  const queueDb = parseInt(process.env.QUEUE_DB || '2');
  const stateDb = parseInt(process.env.STATE_DB || '0');
  
  const stateClient = new Redis({ host: redisHost, port: redisPort, db: stateDb });
  const queueClient = new Redis({ host: redisHost, port: redisPort, db: queueDb });
  
  // Tasks to unblock (verified as complete)
  const tasksToUnblock = [
    'frontend-007',
    'frontend-008',
  ];
  
  console.log(`Loading state from ${stateKey}...`);
  const state = await loadState(stateClient, stateKey);
  
  if (!state.blocked_tasks || state.blocked_tasks.length === 0) {
    console.log('No blocked tasks found.');
    await stateClient.quit();
    await queueClient.quit();
    return;
  }
  
  console.log(`Found ${state.blocked_tasks.length} blocked tasks.`);
  
  // Load tasks.json to get full task definitions
  const tasksJsonPath = path.join(process.cwd(), 'tasks', 'tasks.json');
  const tasksJson = JSON.parse(await fs.readFile(tasksJsonPath, 'utf8'));
  const tasksMap = new Map(tasksJson.map((t: any) => [t.task_id, t]));
  
  // Remove tasks from blocked_tasks and re-enqueue
  const unblocked: string[] = [];
  const notFound: string[] = [];
  
  for (const taskId of tasksToUnblock) {
    const taskIndex = state.blocked_tasks?.findIndex(bt => bt.task_id === taskId);
    if (taskIndex !== undefined && taskIndex >= 0) {
      // Remove from blocked_tasks
      state.blocked_tasks.splice(taskIndex, 1);
      
      // Get full task definition
      const task = tasksMap.get(taskId);
      if (task) {
        // Ensure status is set to pending (blocked tasks should never be autocompleted)
        task.status = 'pending';
        // Re-enqueue
        await enqueueTask(queueClient, queueName, task);
        unblocked.push(taskId);
        console.log(`✅ Unblocked and re-enqueued: ${taskId} (status: pending)`);
      } else {
        notFound.push(taskId);
        console.log(`⚠️ Task definition not found in tasks.json: ${taskId}`);
      }
    } else {
      console.log(`ℹ️ Task not in blocked list: ${taskId}`);
    }
  }
  
  // Persist updated state
  state.last_updated = new Date().toISOString();
  await persistState(stateClient, stateKey, state);
  
  console.log(`\nSummary:`);
  console.log(`- Unblocked and re-enqueued: ${unblocked.length} tasks`);
  if (notFound.length > 0) {
    console.log(`- Task definitions not found: ${notFound.join(', ')}`);
  }
  
  await stateClient.quit();
  await queueClient.quit();
}

unblockTasks().catch(console.error);
