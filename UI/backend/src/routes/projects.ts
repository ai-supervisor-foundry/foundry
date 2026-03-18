// Projects API routes
import { Router } from 'express';
import {
  getRegisteredProjects,
  getProject,
  registerProject,
  unregisterProject,
  discoverProjects,
  openProjectFolderInFileManager,
} from '../services/projectService.js';

const router = Router();

// GET /api/projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await getRegisteredProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/discovered
router.get('/discovered', async (req, res, next) => {
  try {
    const discovered = await discoverProjects();
    res.json({ projects: discovered });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/open-folder — opens sandbox project dir on the server (file manager)
router.post('/:id/open-folder', async (req, res, next) => {
  try {
    const result = await openProjectFolderInFileManager(req.params.id);
    if (result === 'not_found') {
      return res.status(404).json({ error: 'Project or directory not found' });
    }
    if (result === 'bad_path') {
      return res.status(400).json({ error: 'Invalid project path' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id
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

// POST /api/projects
// Body: { id, name, path?, gitUrl?, branch? }
// If gitUrl is provided, clones the repo into sandbox/<id> before registering.
router.post('/', async (req, res, next) => {
  try {
    const { id, name, path, gitUrl, branch } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }

    const result = await registerProject({ id, name, path, gitUrl, branch });

    // Detect git clone error (has a `code` field)
    if ('code' in result) {
      const statusMap: Record<string, number> = {
        GIT_AUTH_FAILED: 403,
        GIT_NOT_FOUND: 404,
        DIR_EXISTS: 409,
        GIT_CLONE_FAILED: 422,
      };
      return res.status(statusMap[result.code] ?? 422).json({ error: result });
    }

    res.json({ success: true, project: result });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id
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
