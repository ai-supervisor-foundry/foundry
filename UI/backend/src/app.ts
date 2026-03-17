// Express app factory (separated from server startup for testability)
import express from 'express';
import cors from 'cors';

import stateRoutes from './routes/state.js';
import logsRoutes from './routes/logs.js';
import tasksRoutes from './routes/tasks.js';
import commandsRoutes from './routes/commands.js';
import configRoutes from './routes/config.js';
import ollamaRoutes from './routes/ollama.js';
import projectsRoutes from './routes/projects.js';

export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/state', stateRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/commands', commandsRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/ollama', ollamaRoutes);
  app.use('/api/projects', projectsRoutes);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}
