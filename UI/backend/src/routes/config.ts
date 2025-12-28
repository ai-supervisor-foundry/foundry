// Config API routes
import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

// GET /api/config
router.get('/', (req, res) => {
  // Return sanitized config (no sensitive data)
  res.json({
    redis: {
      host: config.redis.host,
      port: config.redis.port,
    },
    supervisor: {
      stateKey: config.supervisor.stateKey,
      queueName: config.supervisor.queueName,
      queueDb: config.supervisor.queueDb,
      stateDb: config.supervisor.stateDb,
      sandboxRoot: config.supervisor.sandboxRoot,
    },
    server: {
      port: config.server.port,
      pollInterval: config.server.pollInterval,
    },
  });
});

// POST /api/config
router.post('/', (req, res) => {
  // TODO: Implement config update (validate and update environment/config)
  res.json({ message: 'Config update endpoint - to be implemented' });
});

export default router;

