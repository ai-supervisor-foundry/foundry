// Script to check current goal in state
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6499', 10);
const STATE_KEY = process.env.STATE_KEY || 'supervisor:state';
const STATE_DB = parseInt(process.env.STATE_DB || '0', 10);

async function checkGoal() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: STATE_DB,
  });

  try {
    const rawState = await client.get(STATE_KEY);
    if (!rawState) {
      console.log('No state found');
      return;
    }

    const state = JSON.parse(rawState);
    console.log('Current goal:');
    console.log(JSON.stringify(state.goal, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.quit();
  }
}

checkGoal();

