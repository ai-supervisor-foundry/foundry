#!/usr/bin/env npx ts-node
/**
 * Task Queue Inspector Script
 * 
 * Diagnose task queue state, identify blocked/failed/queued tasks,
 * and monitor retry status. Helps identify stuck or failing tasks.
 * 
 * Usage:
 *   npx ts-node scripts/investigations/task-queue-inspect.ts
 *   npx ts-node scripts/investigations/task-queue-inspect.ts --filter blocked
 *   npx ts-node scripts/investigations/task-queue-inspect.ts --task-id <id>
 */

import Redis from 'ioredis';
import { Command } from 'commander';
import { TaskStateInfo, formatTimestamp, getStatusEmoji } from './schema';

const program = new Command();

program
  .option('--redis-host <host>', 'DragonflyDB host', 'localhost')
  .option('--redis-port <port>', 'DragonflyDB port', '6499')
  .option('--state-db <index>', 'State database index', '0')
  .option('--filter <type>', 'Filter by task type: queued|blocked|failed')
  .option('--task-id <id>', 'Show details for specific task')
  .option('--limit <number>', 'Max tasks to show', '20')
  .option('--json', 'Output JSON format')
  .parse(process.argv);

interface Options {
  redisHost: string;
  redisPort: string;
  stateDb: string;
  filter?: string;
  taskId?: string;
  limit: string;
  json?: boolean;
}

interface SupervisorState {
  queue?: string[];
  blocked_tasks?: {
    [taskId: string]: {
      reason: string;
      blocked_at: string;
      retry_count?: number;
    };
  };
  failed_tasks?: {
    [taskId: string]: {
      reason: string;
      failed_at: string;
      error?: string;
      retry_count?: number;
    };
  };
  current_task?: {
    id: string;
    started_at: string;
  };
}

async function getSupervisorState(client: Redis): Promise<SupervisorState | null> {
  const value = await client.get('supervisor:state');
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getQueueLength(client: Redis): Promise<number> {
  const length = await client.llen('supervisor:queue');
  return length;
}

async function getQueueTasks(client: Redis, limit: number): Promise<string[]> {
  const tasks = await client.lrange('supervisor:queue', 0, limit - 1);
  return tasks;
}

function formatTask(taskId: string, reason?: string, isBlocked = false): string {
  const status = isBlocked ? '🔒' : '⏳';
  const reasonText = reason ? ` [${reason}]` : '';
  return `${status} ${taskId}${reasonText}`;
}

async function main(): Promise<void> {
  const client = new Redis({
    host: program.opts().redisHost,
    port: parseInt(program.opts().redisPort, 10),
    db: parseInt(program.opts().stateDb, 10),
  });

  const options = program.opts() as Options;
  const limit = Math.max(1, parseInt(options.limit, 10));

  try {
    if (!options.json) {
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    TASK QUEUE INSPECTION                       ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
    }

    const state = await getSupervisorState(client);
    const queueLength = await getQueueLength(client);
    const queueTasks = await getQueueTasks(client, limit);

    if (options.json) {
      const output = {
        timestamp: new Date().toISOString(),
        queue: {
          total_length: queueLength,
          tasks: queueTasks,
        },
        blocked_tasks: state?.blocked_tasks || {},
        failed_tasks: state?.failed_tasks || {},
        current_task: state?.current_task || null,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Show current task
    if (state?.current_task) {
      console.log('⚙️  Currently Executing:\n');
      const elapsed = Math.round(
        (Date.now() - new Date(state.current_task.started_at).getTime()) / 1000
      );
      console.log(`  📌 Task: ${state.current_task.id}`);
      console.log(`  Started: ${formatTimestamp(state.current_task.started_at)}`);
      console.log(`  Elapsed: ${elapsed}s`);
      console.log();
    }

    // Show queue status
    console.log(`📋 Task Queue:\n`);
    console.log(`  Total queued: ${queueLength} task(s)`);
    if (queueTasks.length > 0) {
      console.log(
        `  Showing: ${queueTasks.length}/${queueLength}${limit < queueLength ? ' (limited)' : ''}\n`
      );
      queueTasks.forEach((taskId, index) => {
        console.log(`    ${index + 1}. ${taskId}`);
      });
    } else if (queueLength === 0) {
      console.log(`  Queue is empty.\n`);
    }
    console.log();

    // Show blocked tasks
    const blockedTasks = state?.blocked_tasks || {};
    const blockedCount = Object.keys(blockedTasks).length;

    if (blockedCount > 0) {
      console.log(`🔒 Blocked Tasks (${blockedCount}):\n`);
      const entries = Object.entries(blockedTasks).slice(0, limit);
      entries.forEach(([taskId, info], index) => {
        console.log(`  ${index + 1}. ${taskId}`);
        console.log(`     Reason: ${info.reason}`);
        console.log(`     Blocked: ${formatTimestamp(info.blocked_at)}`);
        if (info.retry_count !== undefined) {
          console.log(`     Retry Attempts: ${info.retry_count}`);
        }
      });
      console.log();
    }

    // Show failed tasks
    const failedTasks = state?.failed_tasks || {};
    const failedCount = Object.keys(failedTasks).length;

    if (failedCount > 0) {
      console.log(`❌ Failed Tasks (${failedCount}):\n`);
      const entries = Object.entries(failedTasks).slice(0, limit);
      entries.forEach(([taskId, info], index) => {
        console.log(`  ${index + 1}. ${taskId}`);
        console.log(`     Reason: ${info.reason}`);
        if (info.error) {
          console.log(`     Error: ${info.error.substring(0, 100)}${info.error.length > 100 ? '...' : ''}`);
        }
        console.log(`     Failed: ${formatTimestamp(info.failed_at)}`);
        if (info.retry_count !== undefined) {
          console.log(`     Retry Attempts: ${info.retry_count}`);
        }
      });
      console.log();
    }

    // Summary
    console.log('📊 Summary:\n');
    console.log(`  Total Queued: ${queueLength}`);
    console.log(`  Total Blocked: ${blockedCount}`);
    console.log(`  Total Failed: ${failedCount}`);
    if (state?.current_task) {
      console.log(`  Currently Executing: 1`);
    }
    console.log();

    // Recommendations
    console.log('💡 Recommendations:\n');
    if (queueLength === 0 && blockedCount === 0 && failedCount === 0 && !state?.current_task) {
      console.log('  ✓ Queue is empty. System is idle.');
    } else if (blockedCount > 0) {
      console.log(`  ⚠️  ${blockedCount} task(s) are blocked. Check reasons above.`);
      if (failedCount > 0) {
        console.log(`  ⚠️  ${failedCount} task(s) have failed. May need manual intervention.`);
      }
    } else if (failedCount > 0) {
      console.log(`  ⚠️  ${failedCount} task(s) have failed. Consider running: npm run unblock-tasks`);
    }

    if (queueLength > 50) {
      console.log(`  ℹ️  Large queue detected (${queueLength}). Monitor system performance.`);
    }
    console.log();

    console.log('⚙️  Configuration:');
    console.log(`  - Redis: ${options.redisHost}:${options.redisPort} (DB: ${options.stateDb})`);
    console.log(`  - State Key: supervisor:state`);
    console.log();
  } finally {
    await client.quit();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
