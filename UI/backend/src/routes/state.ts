// State API routes
import { Router } from 'express';
import {
  loadSupervisorState,
  getSupervisorStatus,
  getCurrentTask,
} from '../services/supervisorState.js';

const router = Router();

// GET /api/state - Get current supervisor state
router.get('/', async (req, res, next) => {
  try {
    const state = await loadSupervisorState();
    if (!state) {
      return res.status(404).json({ error: 'Supervisor state not found' });
    }
    res.json(state);
  } catch (error) {
    next(error);
  }
});

// GET /api/state/status - Get supervisor status only
router.get('/status', async (req, res, next) => {
  try {
    const result = await getSupervisorStatus();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/state/current-task - Get current task
router.get('/current-task', async (req, res, next) => {
  try {
    const task = await getCurrentTask();
    // Return null instead of 404 when no current task
    if (!task) {
      return res.json(null);
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

export default router;

