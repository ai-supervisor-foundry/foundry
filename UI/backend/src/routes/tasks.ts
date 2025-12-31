// Tasks API routes
import { Router } from 'express';
import { loadSupervisorState, saveSupervisorState, updateTaskInState } from '../services/supervisorState.js';
import { getQueueLength, peekQueue, enqueueTask, getAllPendingTasks, updateTaskInQueue, removeTaskFromQueue } from '../services/queueService.js';

const router = Router();

// POST /api/tasks/enqueue
router.post('/enqueue', async (req, res, next) => {
  try {
    const task = req.body;
    
    if (!task || !task.task_id || !task.instructions || !task.acceptance_criteria) {
      return res.status(400).json({ error: 'Invalid task: must have task_id, instructions, and acceptance_criteria' });
    }
    
    await enqueueTask(task);

    // Update state to reflect queue is no longer exhausted
    const state = await loadSupervisorState();
    if (state && state.queue.exhausted) {
      state.queue.exhausted = false;
      await saveSupervisorState(state);
    }
    
    res.json({ success: true, message: `Task ${task.task_id} enqueued` });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/dump
router.get('/dump', async (req, res, next) => {
  try {
    const state = await loadSupervisorState();
    const pending = await getAllPendingTasks();
    
    const dump = {
      pending: pending,
      completed: state?.completed_tasks || [],
      blocked: state?.blocked_tasks || [],
      in_progress: state?.current_task ? [state.current_task] : [],
      dumped_at: new Date().toISOString()
    };
    
    res.json(dump);
  } catch (error) {
    next(error);
  }
});

// Helper to remove task from a list
function removeTaskFromList(list: any[], taskId: string): any | null {
  if (!list) return null;
  const index = list.findIndex(t => t.task_id === taskId);
  if (index !== -1) {
    return list.splice(index, 1)[0];
  }
  return null;
}

// POST /api/tasks/update
router.post('/update', async (req, res, next) => {
  try {
    const { taskId, updates } = req.body;
    
    if (!taskId || !updates) {
      return res.status(400).json({ error: 'taskId and updates are required' });
    }
    
    const state = await loadSupervisorState();
    if (!state) return res.status(500).json({ error: 'Failed to load state' });

    // 1. Locate the task
    let taskLocation: 'queue' | 'current' | 'completed' | 'blocked' | null = null;
    let taskData: any = null;

    // Check State lists first
    if (state.completed_tasks?.some((t: any) => t.task_id === taskId)) {
      taskLocation = 'completed';
      taskData = state.completed_tasks.find((t: any) => t.task_id === taskId);
    } else if (state.blocked_tasks?.some((t: any) => t.task_id === taskId)) {
      taskLocation = 'blocked';
      taskData = state.blocked_tasks.find((t: any) => t.task_id === taskId);
    } else if ((state.current_task as any)?.task_id === taskId) {
      taskLocation = 'current';
      taskData = state.current_task;
    }
    
    // Check Queue if not found in state
    if (!taskLocation) {
      const queueTasks = await getAllPendingTasks();
      const queueTask = queueTasks.find(t => t.task_id === taskId);
      if (queueTask) {
        taskLocation = 'queue';
        taskData = queueTask;
      }
    }

    if (!taskLocation || !taskData) {
      return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    // 2. Determine Target Location based on status update
    let targetLocation = taskLocation;
    if (updates.status) {
      if (updates.status === 'completed') targetLocation = 'completed';
      else if (updates.status === 'blocked') targetLocation = 'blocked';
      else if (updates.status === 'pending') targetLocation = 'queue';
      else if (updates.status === 'in_progress') targetLocation = 'current';
    }

    // 3. Prepare Updated Data
    const updatedTask = { ...taskData, ...updates };
    // Ensure status field matches target location
    updatedTask.status = updates.status || (
      targetLocation === 'queue' ? 'pending' : 
      targetLocation === 'current' ? 'in_progress' : 
      targetLocation
    );

    // 4. Perform Move or Update
    if (taskLocation === targetLocation) {
      // Same location: Update in place
      if (taskLocation === 'queue') {
        await updateTaskInQueue(taskId, updates);
      } else {
        // State update
        if (taskLocation === 'completed') {
           const idx = state.completed_tasks!.findIndex((t: any) => t.task_id === taskId);
           state.completed_tasks![idx] = updatedTask;
        } else if (taskLocation === 'blocked') {
           const idx = state.blocked_tasks!.findIndex((t: any) => t.task_id === taskId);
           state.blocked_tasks![idx] = updatedTask;
        } else if (taskLocation === 'current') {
           state.current_task = updatedTask;
        }
        await saveSupervisorState(state);
      }
    } else {
      // Different location: Move
      
      // Remove from source
      if (taskLocation === 'queue') {
        await removeTaskFromQueue(taskId);
      } else {
        if (taskLocation === 'completed') removeTaskFromList(state.completed_tasks!, taskId);
        else if (taskLocation === 'blocked') removeTaskFromList(state.blocked_tasks!, taskId);
        else if (taskLocation === 'current') state.current_task = undefined;
      }

      // Add to target
      if (targetLocation === 'queue') {
        // Enqueue to Redis
        // If moving back to queue, ensure we don't carry over completion reports if inappropriate?
        // But keeping history is fine.
        await enqueueTask(updatedTask);
        
        // If moving to queue, verify exhausted flag
        if (state.queue.exhausted) {
          state.queue.exhausted = false;
        }
      } else {
        // Add to State
        if (targetLocation === 'completed') {
          if (!state.completed_tasks) state.completed_tasks = [];
          if (!updatedTask.completed_at) updatedTask.completed_at = new Date().toISOString();
          state.completed_tasks.push(updatedTask);
        } else if (targetLocation === 'blocked') {
          if (!state.blocked_tasks) state.blocked_tasks = [];
          if (!updatedTask.blocked_at) updatedTask.blocked_at = new Date().toISOString();
          state.blocked_tasks.push(updatedTask);
        } else if (targetLocation === 'current') {
          state.current_task = updatedTask;
        }
      }
      
      // Save state if any state modification occurred
      // (Queue->Queue is handled by updateTaskInQueue, checking here for others)
      if (taskLocation !== 'queue' || targetLocation !== 'queue') {
        await saveSupervisorState(state);
      }
    }

    res.json({ success: true, message: `Task ${taskId} updated and moved to ${targetLocation}` });
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

