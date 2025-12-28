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
}

export function loadConfig(): Config {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6499', 10),
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
  };
}

export const config = loadConfig();

