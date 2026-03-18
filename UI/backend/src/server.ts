// Express server for Supervisor UI backend
import { config } from './config.js';
import { createApp } from './app.js';
import { runMigrations } from './services/db.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await runMigrations();

const app = createApp();

// Request logging middleware (production only, not needed in tests)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Serve static files from frontend/dist in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));

  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Supervisor UI Backend running on http://localhost:${PORT}`);
  console.log(`Configuration:`, {
    redis: `${config.redis.host}:${config.redis.port}`,
    stateKey: config.supervisor.stateKey,
    queueName: config.supervisor.queueName,
    sandboxRoot: config.supervisor.sandboxRoot,
  });
});
