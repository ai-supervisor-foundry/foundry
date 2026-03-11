// Projects API routes
import { Router } from 'express';
import {
  getRegisteredProjects,
  getProject,
  registerProject,
  unregisterProject,
  discoverProjects,
} from '../services/projectService.js';

const router = Router();

// GET /api/projects - List registered projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await getRegisteredProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/discovered - Scan sandbox for all projects (registered + unregistered)
router.get('/discovered', async (req, res, next) => {
  try {
    const discovered = await discoverProjects();
    res.json({ projects: discovered });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: `Project ${req.params.id} not found` });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Register a project
router.post('/', async (req, res, next) => {
  try {
    const { id, name, path } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }
    const project = await registerProject({ id, name, path: path || id });
    res.json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id - Unregister a project
router.delete('/:id', async (req, res, next) => {
  try {
    const removed = await unregisterProject(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: `Project ${req.params.id} not found` });
    }
    res.json({ success: true, message: `Project ${req.params.id} unregistered` });
  } catch (error) {
    next(error);
  }
});

export default router;
