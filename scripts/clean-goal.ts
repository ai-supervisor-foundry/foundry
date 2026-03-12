// Script to clean up goals (remove AI-powered and Gemini mentions)
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

    // Handle both old (goal) and new (goals) shapes
    const goals = state.goals || (state.goal ? { [state.goal.project_id || 'default']: state.goal } : {});

    for (const [projectId, goal] of Object.entries(goals) as [string, any][]) {
      console.log(`\n=== Goal [${projectId}] ===`);
      console.log(goal.description);

      let cleanedGoal = goal.description
        .replace(/AI-powered smart search via Google Gemini API integration,?\s*/gi, '')
        .replace(/AI-powered\s*/gi, '')
        .replace(/Google Gemini API integration,?\s*/gi, '')
        .replace(/Gemini API integration,?\s*/gi, '')
        .replace(/via Google Gemini API integration,?\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanedGoal.includes('The system features')) {
        cleanedGoal = cleanedGoal.replace(/The system features\s*,?\s*/gi, 'The system features ');
      }

      console.log(`\n=== Cleaned [${projectId}] ===`);
      console.log(cleanedGoal);

      goal.description = cleanedGoal;
    }

    // Write back with new shape
    state.goals = goals;
    delete state.goal;
    state.last_updated = new Date().toISOString();

    await client.set(STATE_KEY, JSON.stringify(state));
    console.log('\nGoals cleaned and state updated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

cleanGoal();
