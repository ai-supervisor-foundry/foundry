// Express server for Supervisor UI backend
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
import stateRoutes from './routes/state.js';
import logsRoutes from './routes/logs.js';
import tasksRoutes from './routes/tasks.js';
import commandsRoutes from './routes/commands.js';
import configRoutes from './routes/config.js';
import ollamaRoutes from './routes/ollama.js';

app.use('/api/state', stateRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/commands', commandsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/ollama', ollamaRoutes);

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

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

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

