#!/usr/bin/env npx ts-node
/**
 * Provider Health Diagnostic Script
 * 
 * Diagnose provider availability, circuit breaker status, and priority order.
 * Helps identify why a specific provider is/isn't being used.
 * 
 * Usage:
 *   npx ts-node scripts/investigations/provider-health.ts
 *   npx ts-node scripts/investigations/provider-health.ts --provider gemini
 *   npx ts-node scripts/investigations/provider-health.ts --clear gemini
 */

import Redis from 'ioredis';
import { Command } from 'commander';
import * as readline from 'readline';
import { Provider } from '../../src/domain/agents/enums/provider';
import {
  CircuitBreakerStatus,
  CircuitBreakerInfo,
  calculateTimeRemaining,
  formatTimestamp,
  getStatusEmoji,
} from './schema';
import { DEFAULT_PRIORITY } from '../../src/config/agents/providers/common';

const program = new Command();

program
  .option('--redis-host <host>', 'DragonflyDB host', 'localhost')
  .option('--redis-port <port>', 'DragonflyDB port', '6499')
  .option('--state-db <index>', 'State database index', '0')
  .option('--provider <name>', 'Check specific provider')
  .option('--only-breakers', 'Show only active circuit breakers')
  .option('--clear <provider>', 'Clear circuit breaker for provider')
  .option('--json', 'Output JSON format')
  .parse(process.argv);

interface Options {
  redisHost: string;
  redisPort: string;
  stateDb: string;
  provider?: string;
  onlyBreakers?: boolean;
  clear?: string;
  json?: boolean;
}

const options = program.opts() as Options;

async function getCircuitBreakerStatus(
  client: Redis,
  provider: Provider
): Promise<CircuitBreakerInfo | null> {
  const key = `circuit_breaker:${provider}`;
  const value = await client.get(key);

  if (!value) {
    return null;
  }

  try {
    const status: CircuitBreakerStatus = JSON.parse(value);
    const expiresAt = new Date(status.expires_at);
    const { ms, readable } = calculateTimeRemaining(expiresAt);

    return {
      provider,
      status: ms > 0 ? 'active' : 'expired',
      triggered_at: new Date(status.triggered_at),
      expires_at: expiresAt,
      time_remaining_ms: Math.max(0, ms),
      time_remaining_readable: readable,
      error_type: status.error_type,
    };
  } catch {
    return null;
  }
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function clearCircuitBreaker(
  client: Redis,
  provider: string
): Promise<void> {
  const confirmation = await prompt(
    `⚠️  Clear circuit breaker for ${provider}? This should only be done if the underlying issue is fixed. (yes/no): `
  );

  if (confirmation.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    return;
  }

  const key = `circuit_breaker:${provider}`;
  await client.del(key);
  console.log(`✅ Cleared circuit breaker for ${provider}`);
}

async function main(): Promise<void> {
  const client = new Redis({
    host: options.redisHost,
    port: parseInt(options.redisPort, 10),
    db: parseInt(options.stateDb, 10),
  });

  try {
    if (options.clear) {
      await clearCircuitBreaker(client, options.clear);
      return;
    }

    if (!options.json) {
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    PROVIDER HEALTH REPORT                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
    }

    const allProviders = Object.values(Provider) as Provider[];
    const breakers: CircuitBreakerInfo[] = [];

    for (const provider of allProviders) {
      const breaker = await getCircuitBreakerStatus(client, provider);
      if (breaker) {
        breakers.push(breaker);
      }
    }

    if (options.json) {
      const output = {
        priority_order: DEFAULT_PRIORITY,
        circuit_breakers: breakers.map((b) => ({
          provider: b.provider,
          status: b.status,
          triggered_at: b.triggered_at.toISOString(),
          expires_at: b.expires_at.toISOString(),
          time_remaining_ms: b.time_remaining_ms,
          error_type: b.error_type,
        })),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (!options.onlyBreakers) {
      console.log('📋 Provider Priority Order:\n');
      DEFAULT_PRIORITY.forEach((provider, index) => {
        const breaker = breakers.find((b) => b.provider === provider);
        if (breaker) {
          const emoji = getStatusEmoji(breaker.status);
          const statusText =
            breaker.status === 'active'
              ? `CIRCUIT-BROKEN: ${breaker.error_type}`
              : 'EXPIRED (auto-clearing)';
          console.log(
            `  ${index + 1}. ${provider.padEnd(15)} [${emoji} ${statusText}]`
          );
        } else {
          console.log(`  ${index + 1}. ${provider.padEnd(15)} [🟢 AVAILABLE]`);
        }
      });
      console.log();
    }

    if (breakers.length > 0) {
      console.log(`🔌 Active Circuit Breakers (${breakers.length}):\n`);
      breakers.forEach((breaker) => {
        const emoji = getStatusEmoji(breaker.status);
        console.log(`  ${emoji} ${breaker.provider} (${breaker.error_type})`);
        console.log(`    Triggered: ${formatTimestamp(breaker.triggered_at.toISOString())}`);
        console.log(`    Expires: ${formatTimestamp(breaker.expires_at.toISOString())}`);
        if (breaker.time_remaining_ms > 0) {
          console.log(`    Time Remaining: ${breaker.time_remaining_readable}`);
          console.log(`    Action: Wait or use --clear ${breaker.provider} to reset`);
        } else {
          console.log(`    Time Remaining: EXPIRED (ready to use)`);
          console.log(`    Action: Already expired, will be cleared on next auto-check`);
        }
        console.log();
      });
    } else {
      console.log('✅ No active circuit breakers.\n');
    }

    console.log('⚙️  Configuration:');
    console.log(`  - Redis: ${options.redisHost}:${options.redisPort} (DB: ${options.stateDb})`);
    console.log(`  - Default Priority: ${DEFAULT_PRIORITY.join(' → ')}`);
    console.log();

    console.log('💡 Recommendations:');
    const activeBreakers = breakers.filter((b) => b.status === 'active');
    if (activeBreakers.length === 0) {
      console.log('  ✓ No providers are circuit-broken. System operating normally.');
    } else {
      const activeCount = activeBreakers.length;
      const nextAvailable = DEFAULT_PRIORITY.find(
        (p) => !breakers.find((b) => b.provider === p && b.status === 'active')
      );
      console.log(`  ⚠️  ${activeCount} provider(s) are circuit-broken.`);
      if (nextAvailable) {
        console.log(`  ✓ Next provider in priority: ${nextAvailable}`);
      } else {
        console.log(`  ❌ ALL providers are circuit-broken! System may fail.`);
      }
      activeBreakers.forEach((breaker) => {
        console.log(
          `  ℹ️  ${breaker.provider}: Check API status or credentials. TTL: ${breaker.time_remaining_readable}`
        );
      });
    }
    console.log();
  } finally {
    await client.quit();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
