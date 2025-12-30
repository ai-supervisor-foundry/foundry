
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadState } from '../src/persistence';
import { Command } from 'commander';

const program = new Command();

program
  .option('--redis-host <host>', 'DragonflyDB host', 'localhost')
  .option('--redis-port <port>', 'DragonflyDB port', '6499')
  .option('--state-key <key>', 'Supervisor state key', 'supervisor:state')
  .option('--state-db <index>', 'State database index', (value: string) => parseInt(value || '0', 10), 0)
  .option('--output <path>', 'Output file path', 'STATE.json')
  .parse(process.argv);

async function dumpState() {
  const options = program.opts();
  const client = new Redis({
    host: options.redisHost,
    port: options.redisPort,
    db: options.stateDb,
  });

  try {
    console.log(`Connecting to Redis at ${options.redisHost}:${options.redisPort} (DB: ${options.stateDb})...`);
    console.log(`Reading state from key: ${options.stateKey}`);

    const state = await loadState(client, options.stateKey);
    const outputPath = path.resolve(process.cwd(), options.output);
    
    await fs.writeFile(outputPath, JSON.stringify(state, null, 2));
    console.log(`State successfully dumped to: ${outputPath}`);
  } catch (error) {
    console.error('Failed to dump state:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.quit();
  }
}

dumpState();
