// Script to update resource_exhausted_retry state
// Usage: pnpm tsx update-retry-state.ts

import Redis from 'ioredis';
import { SupervisorState } from './src/types.js';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6499', 10);
const STATE_KEY = process.env.STATE_KEY || 'supervisor:state';
const STATE_DB = parseInt(process.env.STATE_DB || '0', 10);

async function updateRetryState() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: STATE_DB,
  });

  try {
    console.log(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT} (DB ${STATE_DB})`);
    console.log(`Loading state from key: ${STATE_KEY}`);

    // Load current state
    const rawState = await client.get(STATE_KEY);
    if (!rawState) {
      throw new Error(`State not found at key: ${STATE_KEY}`);
    }

    const state: SupervisorState = JSON.parse(rawState);
    console.log('Current state loaded');
    console.log('Current resource_exhausted_retry:', JSON.stringify(state.supervisor.resource_exhausted_retry, null, 2));

    // Set attempt to 5 and next_retry_at to 14:01 UTC
    const nextRetryDate = new Date('2025-12-28T14:01:00.000Z');
    const now = new Date();

    state.supervisor.resource_exhausted_retry = {
      attempt: 5,
      last_attempt_at: now.toISOString(),
      next_retry_at: nextRetryDate.toISOString(),
    };

    console.log('\nUpdated resource_exhausted_retry:');
    console.log(JSON.stringify(state.supervisor.resource_exhausted_retry, null, 2));

    // Persist updated state
    await client.set(STATE_KEY, JSON.stringify(state));
    console.log('\n✅ State updated successfully!');
    console.log(`Next retry at: ${nextRetryDate.toISOString()}`);
    console.log(`Attempt: 5`);

  } catch (error) {
    console.error('❌ Error updating state:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

updateRetryState();

