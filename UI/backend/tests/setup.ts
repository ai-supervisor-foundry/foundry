// Mock ioredis before any imports
jest.mock('ioredis', () => {
  return require('./mocks/ioredis').default;
});

// Mock logReader (uses import.meta.url which is ESM-only)
jest.mock('../src/services/logReader', () => ({
  getAuditLogs: jest.fn().mockResolvedValue([]),
  getPromptLogs: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
  getAvailableProjects: jest.fn().mockResolvedValue([]),
}));

// Mock projectService (uses pg + import.meta.url which are not available in tests)
// In-memory implementation backed by the Redis mock to keep existing tests working.
jest.mock('../src/services/projectService', () => {
  const MockRedis = require('./mocks/ioredis').default;

  const PROJECTS_KEY = 'supervisor:projects';

  return {
    getRegisteredProjects: jest.fn(async () => {
      const redis = MockRedis.getInstance();
      const raw = await redis.hgetall(PROJECTS_KEY);
      return Object.values(raw).map((v: string) => {
        const p = JSON.parse(v);
        return { ...p, git_head: null, checked_out_branch: null };
      });
    }),
    getProject: jest.fn(async (id: string) => {
      const redis = MockRedis.getInstance();
      const raw = await redis.hget(PROJECTS_KEY, id);
      return raw ? JSON.parse(raw) : null;
    }),
    registerProject: jest.fn(async (project: any) => {
      // Reject IDs with unsafe characters (mirrors real sanitizeProjectId)
      if (!/^[a-zA-Z0-9_-]+$/.test(project.id)) {
        return { code: 'GIT_CLONE_FAILED', hint: 'Project ID may only contain letters, numbers, hyphens, and underscores.' };
      }
      const redis = MockRedis.getInstance();
      const full = {
        id: project.id,
        name: project.name,
        path: project.path || project.id,
        git_url: project.gitUrl ?? null,
        branch: project.branch ?? null,
        registered_at: new Date().toISOString(),
        status: project.status || 'active',
      };
      await redis.hset(PROJECTS_KEY, project.id, JSON.stringify(full));
      return full;
    }),
    unregisterProject: jest.fn(async (id: string) => {
      const redis = MockRedis.getInstance();
      const removed = await redis.hdel(PROJECTS_KEY, id);
      return removed > 0;
    }),
    discoverProjects: jest.fn(async () => []),
    openProjectFolderInFileManager: jest.fn(async (id: string) => {
      const redis = MockRedis.getInstance();
      const raw = await redis.hget(PROJECTS_KEY, id);
      return raw ? 'ok' : 'not_found';
    }),
  };
});

// Mock child_process.exec for command executor tests
jest.mock('child_process', () => {
  const original = jest.requireActual('child_process');
  return {
    ...original,
    exec: jest.fn((_cmd: string, _opts: any, cb: any) => {
      const callback = typeof _opts === 'function' ? _opts : cb;
      if (callback) callback(null, { stdout: 'mocked output', stderr: '' });
      return { kill: jest.fn() };
    }),
  };
});

// Mock fs/promises for project discovery
jest.mock('fs/promises', () => {
  const original = jest.requireActual('fs/promises');
  return {
    ...original,
    access: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
  };
});
