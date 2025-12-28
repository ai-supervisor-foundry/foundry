// Logs API routes
import { Router } from 'express';
import {
  getAuditLogs,
  getPromptLogs,
  getAvailableProjects,
} from '../services/logReader.js';

const router = Router();

// GET /api/logs/projects - Get available projects
router.get('/projects', async (req, res, next) => {
  try {
    const projects = await getAvailableProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/audit?projectId=<id>&limit=<n>
router.get('/audit', async (req, res, next) => {
  try {
    const projectId = req.query.projectId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    const logs = await getAuditLogs(projectId, { limit });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/prompts?projectId=<id>&limit=<n>
router.get('/prompts', async (req, res, next) => {
  try {
    const projectId = req.query.projectId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const type = req.query.type as string | undefined;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    const logs = await getPromptLogs(projectId, { limit, type: type as any });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/audit/:taskId
router.get('/audit/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const projectId = req.query.projectId as string;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    const logs = await getAuditLogs(projectId, { taskId });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/prompts/:taskId
router.get('/prompts/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const projectId = req.query.projectId as string;
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    
    const logs = await getPromptLogs(projectId, { taskId });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

export default router;

