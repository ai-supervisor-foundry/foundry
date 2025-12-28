// Commands API routes
import { Router } from 'express';
import {
  executeSupervisorCommand,
  executeShellCommand,
  getCommandHistory,
} from '../services/commandExecutor.js';

const router = Router();

// POST /api/commands/supervisor
router.post('/supervisor', async (req, res, next) => {
  try {
    const { command, options = {} } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }
    
    const result = await executeSupervisorCommand(command, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/commands/shell
router.post('/shell', async (req, res, next) => {
  try {
    const { command, cwd, timeout } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }
    
    const result = await executeShellCommand(command, { cwd, timeout });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

// GET /api/commands/history
router.get('/history', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const history = getCommandHistory(limit);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

export default router;

