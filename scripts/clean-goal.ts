// Script to clean up goal (remove AI-powered and Gemini mentions)
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6499', 10);
const STATE_KEY = process.env.STATE_KEY || 'supervisor:state';
const STATE_DB = parseInt(process.env.STATE_DB || '0', 10);

async function cleanGoal() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: STATE_DB,
  });

  try {
    console.log(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT} (DB ${STATE_DB})`);
    console.log(`Loading state from key: ${STATE_KEY}`);

    const rawState = await client.get(STATE_KEY);
    if (!rawState) {
      throw new Error(`State not found at key: ${STATE_KEY}`);
    }

    const state = JSON.parse(rawState);
    console.log('\n=== Current Goal ===');
    console.log(state.goal.description);

    // Clean up: Remove AI-powered and Gemini mentions
    let cleanedGoal = state.goal.description
      .replace(/AI-powered smart search via Google Gemini API integration,?\s*/gi, '')
      .replace(/AI-powered\s*/gi, '')
      .replace(/Google Gemini API integration,?\s*/gi, '')
      .replace(/Gemini API integration,?\s*/gi, '')
      .replace(/via Google Gemini API integration,?\s*/gi, '')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Ensure proper sentence structure
    if (cleanedGoal.includes('The system features')) {
      cleanedGoal = cleanedGoal.replace(/The system features\s*,?\s*/gi, 'The system features ');
    }

    console.log('\n=== Cleaned Goal ===');
    console.log(cleanedGoal);

    // Update state
    state.goal.description = cleanedGoal;
    state.last_updated = new Date().toISOString();

    await client.set(STATE_KEY, JSON.stringify(state));
    console.log('\n✅ Goal cleaned and state updated successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

cleanGoal();

