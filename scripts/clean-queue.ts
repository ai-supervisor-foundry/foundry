
import Redis from 'ioredis';

// --- Configuration ---
// These values are based on the defaults in the project's README.
// Replace them if your setup is different.
const REDIS_HOST = 'localhost';
const REDIS_PORT = 6499;
const STATE_DB = 0;
const QUEUE_DB = 2; // As per README examples
const STATE_KEY = 'supervisor:state';
const QUEUE_NAME = 'tasks'; // As per README examples

// --- Script ---

async function clearQueueAndTasks() {
  const stateRedis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: STATE_DB,
  });

  const queueRedis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: QUEUE_DB,
  });

  try {
    // 1. Clear task-related fields from the main state
    console.log(`Connecting to Redis on db ${STATE_DB} to modify state...`);
    const currentStateJSON = await stateRedis.get(STATE_KEY);

    if (!currentStateJSON) {
      console.log(`No state found for key '${STATE_KEY}'. Nothing to do.`);
      return;
    }

    const state = JSON.parse(currentStateJSON);

    // Reset task-related fields
    state.current_task = null;
    state.completed_tasks = [];
    state.blocked_tasks = [];
    
    // Reset queue statistics in state if they exist
    if (state.queue) {
        state.queue.exhausted = true;
    }
    if (state.supervisor) {
        // Resetting retry counts that might be stored at the supervisor level
        for (const key in state.supervisor) {
            if (key.startsWith('retry_count_')) {
                delete state.supervisor[key];
            }
        }
    }


    await stateRedis.set(STATE_KEY, JSON.stringify(state, null, 2));
    console.log(`Successfully reset task-related fields in '${STATE_KEY}'.`);
    console.log('- Set current_task to null.');
    console.log('- Emptied completed_tasks array.');
    console.log('- Emptied blocked_tasks array.');

    // 2. Clear the actual queue
    console.log(`\nConnecting to Redis on db ${QUEUE_DB} to clear the queue...`);
    
    // Option 1: Delete the specific queue list
    const queueKey = `queue:${QUEUE_NAME}`;
    const result = await queueRedis.del(queueKey);

    if (result > 0) {
        console.log(`Successfully deleted queue '${queueKey}'.`);
    } else {
        console.log(`Queue '${queueKey}' not found. It might have been cleared already.`);
    }

    // Option 2: Flush the entire DB (more aggressive, but used in docs)
    // await queueRedis.flushdb();
    // console.log(`Successfully flushed database ${QUEUE_DB}.`);

    console.log('\n✅ Queue and task state have been cleared.');

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    stateRedis.disconnect();
    queueRedis.disconnect();
  }
}

clearQueueAndTasks();
