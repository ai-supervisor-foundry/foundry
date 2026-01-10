
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { persistState } from '../src/application/services/persistence';
import { SupervisorState } from '../src/domain/types/types';
import { Command } from 'commander';

const program = new Command();

program
  .option('--redis-host <host>', 'DragonflyDB host', 'localhost')
  .option('--redis-port <port>', 'DragonflyDB port', '6499')
  .option('--state-key <key>', 'Supervisor state key', 'supervisor:state')
  .option('--state-db <index>', 'State database index', (value: string) => parseInt(value || '0', 10), 0)
  .option('--input <path>', 'Input file path', 'STATE.json')
  .parse(process.argv);

async function loadStateFromFile() {
  const options = program.opts();
  const client = new Redis({
    host: options.redisHost,
    port: options.redisPort,
    db: options.stateDb,
  });

  try {
    const inputPath = path.resolve(process.cwd(), options.input);
    console.log(`Reading state from file: ${inputPath}`);
    
    const fileContent = await fs.readFile(inputPath, 'utf-8');
    const state: SupervisorState = JSON.parse(fileContent);

    console.log(`Connecting to Redis at ${options.redisHost}:${options.redisPort} (DB: ${options.stateDb})...`);
    console.log(`Writing state to key: ${options.stateKey}`);

    await persistState(client, options.stateKey, state);
    console.log(`State successfully loaded to Redis key: ${options.stateKey}`);
  } catch (error) {
    console.error('Failed to load state:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.quit();
  }
}

loadStateFromFile();
