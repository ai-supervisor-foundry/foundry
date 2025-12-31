// Tasks API routes
import { Router } from 'express';
import { loadSupervisorState, updateTaskInState } from '../services/supervisorState.js';
import { getQueueLength, peekQueue } from '../services/queueService.js';

const router = Router();

// POST /api/tasks/update
router.post('/update', async (req, res, next) => {
  try {
    const { taskId, updates } = req.body;
    
    if (!taskId || !updates) {
      return res.status(400).json({ error: 'taskId and updates are required' });
    }
    
    const success = await updateTaskInState(taskId, updates);
    
    if (success) {
      res.json({ success: true, message: `Task ${taskId} updated` });
    } else {
      res.status(404).json({ error: `Task ${taskId} not found in state (completed or blocked)` });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/completed
router.get('/completed', async (req, res, next) => {
  try {
    const state = await loadSupervisorState();
    if (!state) {
      return res.status(404).json({ error: 'Supervisor state not found' });
    }
    res.json({ tasks: state.completed_tasks || [] });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/blocked
router.get('/blocked', async (req, res, next) => {
  try {
    const state = await loadSupervisorState();
    if (!state) {
      return res.status(404).json({ error: 'Supervisor state not found' });
    }
    res.json({ tasks: state.blocked_tasks || [] });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/queue
router.get('/queue', async (req, res, next) => {
  try {
    const length = await getQueueLength();
    // Default to showing all tasks, but allow limit for pagination
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : length || 100;
    const pending = await peekQueue(limit);
    
    const state = await loadSupervisorState();
    const exhausted = state?.queue.exhausted || false;
    
    res.json({
      length,
      exhausted,
      pending,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

