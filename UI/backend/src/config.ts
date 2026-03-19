// Configuration loader for UI backend
// Loads from environment variables with defaults
import dotenv from 'dotenv';

// Load .env file if it exists
dotenv.config();

export interface Config {
  redis: {
    host: string;
    port: number;
  };
  postgres: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  supervisor: {
    stateKey: string;
    queueName: string;
    queueDb: number;
    stateDb: number;
    sandboxRoot: string;
  };
  server: {
    port: number;
    pollInterval: number;
  };
  ollama: {
    baseUrl: string;
  };
}

export function loadConfig(): Config {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6499', 10),
    },
    postgres: {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5433', 10),
      user: process.env.PG_USER || 'supervisor',
      password: process.env.PG_PASSWORD || 'supervisor',
      database: process.env.PG_DATABASE || 'supervisor',
    },
    supervisor: {
      stateKey: process.env.STATE_KEY || 'supervisor:state',
      queueName: process.env.QUEUE_NAME || 'tasks',
      queueDb: parseInt(process.env.QUEUE_DB || '2', 10),
      stateDb: parseInt(process.env.STATE_DB || '0', 10),
      sandboxRoot: process.env.SANDBOX_ROOT || './sandbox',
    },
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
      pollInterval: parseInt(process.env.POLL_INTERVAL || '60000', 10),
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
  };
}

export const config = loadConfig();

