// Project Service
// Manages project registry in Redis and discovers projects from sandbox
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_KEY = 'supervisor:projects';

export interface Project {
  id: string;
  name: string;
  path: string; // Relative to sandboxRoot
  registered_at: string;
  status: 'active' | 'archived';
}

export interface DiscoveredProject {
  id: string;
  path: string;
  registered: boolean;
}

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.supervisor.stateDb,
      maxRetriesPerRequest: 3,
    });
  }
  return redisClient;
}

function resolveSandboxRoot(): string {
  const sandboxRoot = config.supervisor.sandboxRoot;
  if (path.isAbsolute(sandboxRoot)) {
    return sandboxRoot;
  }
  const supervisorRoot = path.resolve(__dirname, '../../../../');
  return path.resolve(supervisorRoot, sandboxRoot);
}

/**
 * Get all registered projects from Redis
 */
export async function getRegisteredProjects(): Promise<Project[]> {
  const client = getRedisClient();
  const raw = await client.hgetall(PROJECTS_KEY);
  return Object.values(raw).map(v => JSON.parse(v) as Project);
}

/**
 * Get a single registered project
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const client = getRedisClient();
  const raw = await client.hget(PROJECTS_KEY, projectId);
  return raw ? JSON.parse(raw) as Project : null;
}

/**
 * Register a project
 */
export async function registerProject(project: Omit<Project, 'registered_at' | 'status'> & { status?: string }): Promise<Project> {
  const client = getRedisClient();
  const full: Project = {
    id: project.id,
    name: project.name,
    path: project.path,
    registered_at: new Date().toISOString(),
    status: (project.status as 'active' | 'archived') || 'active',
  };
  await client.hset(PROJECTS_KEY, project.id, JSON.stringify(full));
  return full;
}

/**
 * Unregister a project
 */
export async function unregisterProject(projectId: string): Promise<boolean> {
  const client = getRedisClient();
  const removed = await client.hdel(PROJECTS_KEY, projectId);
  return removed > 0;
}

/**
 * Discover projects from sandbox directories and diff with registry
 */
export async function discoverProjects(): Promise<DiscoveredProject[]> {
  const sandboxRoot = resolveSandboxRoot();
  const registered = await getRegisteredProjects();
  const registeredIds = new Set(registered.map(p => p.id));

  try {
    await fs.access(sandboxRoot);
  } catch {
    return [];
  }

  const entries = await fs.readdir(sandboxRoot, { withFileTypes: true });
  const dirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name);

  return dirs.map(dir => ({
    id: dir,
    path: dir,
    registered: registeredIds.has(dir),
  }));
}
