import request from 'supertest';
import { createApp } from '../src/app';
import type { Application } from 'express';
import MockRedis from './mocks/ioredis';

describe('UI Backend API - Functional Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    MockRedis.reset();
  });

  // ─── Health ──────────────────────────────────────────────
  describe('GET /api/health', () => {
    it('should return ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ─── Config ──────────────────────────────────────────────
  describe('GET /api/config', () => {
    it('should return sanitized config', async () => {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body.redis).toBeDefined();
      expect(res.body.supervisor).toBeDefined();
      expect(res.body.server).toBeDefined();
    });
  });

  // ─── State ───────────────────────────────────────────────
  describe('State API', () => {
    const sampleState = {
      supervisor: { status: 'RUNNING', iteration: 5 },
      goals: { 'test-project': { description: 'Build app', completed: false, project_id: 'test-project' } },
      active_tasks: {},
      completed_tasks: [{ task_id: 'task-1', completed_at: '2026-01-01T00:00:00Z' }],
      blocked_tasks: [],
      queue: { exhausted: false },
      last_updated: '2026-01-01T00:00:00Z',
      execution_mode: 'AUTO',
    };

    beforeEach(async () => {
      // Seed state into Redis mock
      const redis = MockRedis.getInstance();
      await redis.set('supervisor:state', JSON.stringify(sampleState));
    });

    it('GET /api/state should return full state', async () => {
      const res = await request(app).get('/api/state');
      expect(res.status).toBe(200);
      expect(res.body.supervisor.status).toBe('RUNNING');
      expect(res.body.supervisor.iteration).toBe(5);
      expect(res.body.goals['test-project']).toBeDefined();
      expect(res.body.completed_tasks).toHaveLength(1);
    });

    it('GET /api/state should return 404 when no state exists', async () => {
      MockRedis.reset();
      const res = await request(app).get('/api/state');
      expect(res.status).toBe(404);
    });

    it('GET /api/state/status should return status only', async () => {
      const res = await request(app).get('/api/state/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RUNNING');
    });

    it('GET /api/state/current-task should return null when no active task', async () => {
      const res = await request(app).get('/api/state/current-task');
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('GET /api/state/current-task should return active task when present', async () => {
      const stateWithTask = {
        ...sampleState,
        active_tasks: {
          'task-active': {
            task: { task_id: 'task-active', intent: 'Build feature', instructions: 'Do things' },
            worker_id: 'main',
            started_at: '2026-01-01T00:00:00Z',
          },
        },
      };
      const redis = MockRedis.getInstance();
      await redis.set('supervisor:state', JSON.stringify(stateWithTask));

      const res = await request(app).get('/api/state/current-task');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ─── Tasks ───────────────────────────────────────────────
  describe('Tasks API', () => {
    const sampleState = {
      supervisor: { status: 'RUNNING', iteration: 0 },
      goals: { 'test-project': { description: 'Goal', completed: false, project_id: 'test-project' } },
      active_tasks: {},
      completed_tasks: [],
      blocked_tasks: [],
      queue: { exhausted: true },
      last_updated: '2026-01-01T00:00:00Z',
      execution_mode: 'AUTO',
    };

    beforeEach(async () => {
      const redis = MockRedis.getInstance();
      await redis.set('supervisor:state', JSON.stringify(sampleState));
    });

    it('POST /api/tasks/enqueue should enqueue a valid task', async () => {
      const task = {
        task_id: 'task-new-1',
        project_id: 'test-project',
        intent: 'Create file',
        instructions: 'Create hello.ts',
        acceptance_criteria: ['file exists'],
        affects_files: ['hello.ts'],
        status: 'pending',
      };

      const res = await request(app).post('/api/tasks/enqueue').send(task);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify queue is no longer exhausted
      const stateRes = await request(app).get('/api/state');
      expect(stateRes.body.queue.exhausted).toBe(false);
    });

    it('POST /api/tasks/enqueue should reject invalid task', async () => {
      const res = await request(app).post('/api/tasks/enqueue').send({ task_id: 'bad' });
      expect(res.status).toBe(400);
    });

    it('POST /api/tasks/enqueue-bulk should enqueue multiple tasks', async () => {
      const tasks = [
        { task_id: 't1', project_id: 'p1', intent: 'A', instructions: 'Do A', acceptance_criteria: ['done'], affects_files: [], status: 'pending' },
        { task_id: 't2', project_id: 'p1', intent: 'B', instructions: 'Do B', acceptance_criteria: ['done'], affects_files: [], status: 'pending' },
      ];

      const res = await request(app).post('/api/tasks/enqueue-bulk').send(tasks);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    it('POST /api/tasks/enqueue-bulk should reject non-array body', async () => {
      const res = await request(app).post('/api/tasks/enqueue-bulk').send({ not: 'an array' });
      expect(res.status).toBe(400);
    });

    it('GET /api/tasks/queue should return queue contents', async () => {
      // Enqueue a task first
      const task = {
        task_id: 'task-q1',
        project_id: 'test-project',
        intent: 'Queue test',
        instructions: 'Test queue',
        acceptance_criteria: ['queued'],
        affects_files: [],
        status: 'pending',
      };
      await request(app).post('/api/tasks/enqueue').send(task);

      const res = await request(app).get('/api/tasks/queue');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pending).toBeDefined();
    });

    it('GET /api/tasks/completed should return completed tasks', async () => {
      const stateWithCompleted = {
        ...sampleState,
        completed_tasks: [{ task_id: 'done-1', completed_at: '2026-01-01' }],
      };
      const redis = MockRedis.getInstance();
      await redis.set('supervisor:state', JSON.stringify(stateWithCompleted));

      const res = await request(app).get('/api/tasks/completed');
      expect(res.status).toBe(200);
      expect(res.body.tasks).toHaveLength(1);
    });

    it('GET /api/tasks/blocked should return blocked tasks', async () => {
      const stateWithBlocked = {
        ...sampleState,
        blocked_tasks: [{ task_id: 'blocked-1', blocked_at: '2026-01-01', reason: 'Test' }],
      };
      const redis = MockRedis.getInstance();
      await redis.set('supervisor:state', JSON.stringify(stateWithBlocked));

      const res = await request(app).get('/api/tasks/blocked');
      expect(res.status).toBe(200);
      expect(res.body.tasks).toHaveLength(1);
    });

    it('GET /api/tasks/dump should return all task categories', async () => {
      const res = await request(app).get('/api/tasks/dump');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pending');
      expect(res.body).toHaveProperty('completed');
      expect(res.body).toHaveProperty('blocked');
      expect(res.body).toHaveProperty('in_progress');
      expect(res.body).toHaveProperty('dumped_at');
    });

    it('POST /api/tasks/update should update a task in state', async () => {
      const stateWithBlocked = {
        ...sampleState,
        blocked_tasks: [{ task_id: 'blocked-fix', blocked_at: '2026-01-01', reason: 'Was stuck', status: 'blocked' }],
      };
      const redis = MockRedis.getInstance();
      await redis.set('supervisor:state', JSON.stringify(stateWithBlocked));

      const res = await request(app).post('/api/tasks/update').send({
        taskId: 'blocked-fix',
        updates: { status: 'pending' },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/tasks/update should return 404 for unknown task', async () => {
      const res = await request(app).post('/api/tasks/update').send({
        taskId: 'nonexistent',
        updates: { status: 'completed' },
      });
      expect(res.status).toBe(404);
    });

    it('POST /api/tasks/update should return 400 without required fields', async () => {
      const res = await request(app).post('/api/tasks/update').send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── Commands ────────────────────────────────────────────
  describe('Commands API', () => {
    it('POST /api/commands/supervisor should reject missing command', async () => {
      const res = await request(app).post('/api/commands/supervisor').send({});
      expect(res.status).toBe(400);
    });

    it('GET /api/commands/history should return empty history initially', async () => {
      const res = await request(app).get('/api/commands/history');
      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
    });

    it('POST /api/commands/shell should reject missing command', async () => {
      const res = await request(app).post('/api/commands/shell').send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── Projects ────────────────────────────────────────────
  describe('Projects API', () => {
    it('GET /api/projects should return empty list initially', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual([]);
    });

    it('POST /api/projects should register a project', async () => {
      const res = await request(app).post('/api/projects').send({
        id: 'my-project',
        name: 'My Project',
        path: 'my-project',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.project.id).toBe('my-project');
      expect(res.body.project.status).toBe('active');
    });

    it('GET /api/projects should list registered projects', async () => {
      // Register first
      await request(app).post('/api/projects').send({
        id: 'proj-1',
        name: 'Project 1',
      });

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/projects/:id should return a specific project', async () => {
      await request(app).post('/api/projects').send({
        id: 'proj-detail',
        name: 'Detail Project',
      });

      const res = await request(app).get('/api/projects/proj-detail');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('proj-detail');
      expect(res.body.name).toBe('Detail Project');
    });

    it('GET /api/projects/:id should return 404 for unknown project', async () => {
      const res = await request(app).get('/api/projects/nonexistent');
      expect(res.status).toBe(404);
    });

    it('DELETE /api/projects/:id should unregister a project', async () => {
      await request(app).post('/api/projects').send({
        id: 'proj-delete',
        name: 'To Delete',
      });

      const res = await request(app).delete('/api/projects/proj-delete');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify gone
      const getRes = await request(app).get('/api/projects/proj-delete');
      expect(getRes.status).toBe(404);
    });

    it('DELETE /api/projects/:id should return 404 for unknown project', async () => {
      const res = await request(app).delete('/api/projects/nonexistent');
      expect(res.status).toBe(404);
    });

    it('POST /api/projects should reject missing fields', async () => {
      const res = await request(app).post('/api/projects').send({ id: 'only-id' });
      expect(res.status).toBe(400);
    });
  });
});
