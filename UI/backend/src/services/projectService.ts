// Project Service
// Manages projects in PostgreSQL; git clone support for new projects.
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { getPool, writeAuditLog } from './db.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Project {
  id: string;
  name: string;
  path: string;
  git_url?: string | null;
  branch?: string | null;
  registered_at: string;
  status: 'active' | 'archived';
  /** Short SHA of checked-out HEAD (live), when path is a git work tree */
  git_head?: string | null;
  /** Current branch name, or "detached", or null if not git / unreadable */
  checked_out_branch?: string | null;
}

export interface DiscoveredProject {
  id: string;
  path: string;
  registered: boolean;
}

export interface GitCloneError {
  code: 'GIT_AUTH_FAILED' | 'GIT_NOT_FOUND' | 'GIT_CLONE_FAILED' | 'DIR_EXISTS';
  hint: string;
  detail?: string;
}

function resolveSandboxRoot(): string {
  const sandboxRoot = config.supervisor.sandboxRoot;
  if (path.isAbsolute(sandboxRoot)) return sandboxRoot;
  const supervisorRoot = path.resolve(__dirname, '../../../../');
  return path.resolve(supervisorRoot, sandboxRoot);
}

function sanitizeProjectId(id: string): string | null {
  // Allow only safe directory name characters
  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

/** Absolute sandbox project directory; null if path escapes sandbox */
export function resolveProjectDirectory(project: Pick<Project, 'path'>): string | null {
  const sandboxRoot = path.resolve(resolveSandboxRoot());
  const abs = path.resolve(sandboxRoot, path.normalize(project.path));
  if (abs !== sandboxRoot && !abs.startsWith(sandboxRoot + path.sep)) {
    return null;
  }
  return abs;
}

async function readGitWorkingCopy(dir: string): Promise<{ head: string | null; branch: string | null }> {
  try {
    await fs.access(path.join(dir, '.git'));
  } catch {
    try {
      await execFileAsync('git', ['-C', dir, 'rev-parse', '--git-dir'], { timeout: 5000 });
    } catch {
      return { head: null, branch: null };
    }
  }
  try {
    const { stdout: sha } = await execFileAsync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], {
      timeout: 8000,
      maxBuffer: 64 * 1024,
    });
    const { stdout: ref } = await execFileAsync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeout: 8000,
      maxBuffer: 64 * 1024,
    });
    const r = ref.trim();
    const head = (sha || '').trim() || null;
    const branch = r === 'HEAD' ? 'detached' : r || null;
    return { head, branch };
  } catch {
    return { head: null, branch: null };
  }
}

export async function getRegisteredProjects(): Promise<Project[]> {
  const { rows } = await getPool().query<Project>(
    `SELECT id, name, path, git_url, branch, status,
            registered_at::text AS registered_at
     FROM projects ORDER BY registered_at DESC`
  );
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const dir = resolveProjectDirectory(row);
      if (!dir) {
        return { ...row, git_head: null, checked_out_branch: null };
      }
      try {
        await fs.access(dir);
      } catch {
        return { ...row, git_head: null, checked_out_branch: null };
      }
      const { head, branch } = await readGitWorkingCopy(dir);
      return { ...row, git_head: head, checked_out_branch: branch };
    })
  );
  return enriched;
}

/** Opens the project folder in the system file manager (server machine). */
export async function openProjectFolderInFileManager(projectId: string): Promise<'ok' | 'not_found' | 'bad_path'> {
  const project = await getProject(projectId);
  if (!project) return 'not_found';
  const dir = resolveProjectDirectory(project);
  if (!dir) return 'bad_path';
  try {
    await fs.access(dir);
  } catch {
    return 'not_found';
  }
  try {
    if (process.platform === 'win32') {
      await execFileAsync('explorer.exe', [dir], { timeout: 15000 });
    } else if (process.platform === 'darwin') {
      await execFileAsync('open', [dir], { timeout: 15000 });
    } else {
      await execFileAsync('xdg-open', [dir], { timeout: 15000 });
    }
  } catch (e) {
    console.error('[projectService] open folder failed:', e);
    return 'not_found';
  }
  return 'ok';
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { rows } = await getPool().query<Project>(
    `SELECT id, name, path, git_url, branch, status,
            registered_at::text AS registered_at
     FROM projects WHERE id = $1`,
    [projectId]
  );
  return rows[0] ?? null;
}

/**
 * Register a project. Optionally clone from git first.
 * If gitUrl is provided:
 *   1. Creates sandbox/<id> directory.
 *   2. Runs: git clone <gitUrl> [--branch <branch>] <destDir>
 *   3. Returns structured GitCloneError on failure.
 */
export async function registerProject(
  project: { id: string; name: string; path?: string; gitUrl?: string; branch?: string; status?: string }
): Promise<Project | GitCloneError> {
  const safeId = sanitizeProjectId(project.id);
  if (!safeId) {
    return { code: 'GIT_CLONE_FAILED', hint: 'Project ID may only contain letters, numbers, hyphens, and underscores.' };
  }

  const sandboxRoot = resolveSandboxRoot();
  const destDir = path.join(sandboxRoot, safeId);

  if (project.gitUrl) {
    // Validate URL is http/https/git/ssh — reject anything that looks like a shell injection
    if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(project.gitUrl)) {
      return { code: 'GIT_CLONE_FAILED', hint: 'Git URL must start with https://, git@, or ssh://' };
    }

    // Check destination doesn't already exist
    try {
      await fs.access(destDir);
      return { code: 'DIR_EXISTS', hint: `sandbox/${safeId} already exists. Remove it or choose a different ID.` };
    } catch {
      // Directory does not exist — good
    }

    const args = ['clone'];
    if (project.branch) {
      args.push('--branch', project.branch);
    }
    args.push(project.gitUrl, destDir);

    try {
      await execFileAsync('git', args, { timeout: 120_000 });
    } catch (err: any) {
      const stderr: string = err.stderr || err.message || '';
      if (/authentication failed|could not read username|permission denied/i.test(stderr)) {
        return { code: 'GIT_AUTH_FAILED', hint: 'Authentication failed. Ensure SSH keys or GITHUB_TOKEN are configured on this machine.', detail: stderr };
      }
      if (/repository.*not found|does not exist/i.test(stderr)) {
        return { code: 'GIT_NOT_FOUND', hint: 'Repository not found. Check the URL and your access rights.', detail: stderr };
      }
      return { code: 'GIT_CLONE_FAILED', hint: 'git clone failed.', detail: stderr };
    }
  }

  // Ensure project directory exists and is a git repo
  // (git clone already handles both; for non-git projects, create dir + init repo)
  await fs.mkdir(destDir, { recursive: true });
  if (!project.gitUrl) {
    try {
      await execFileAsync('git', ['init', '-b', 'main'], { cwd: destDir, timeout: 10_000 });
    } catch {
      // git init failed — directory still usable, just won't be a repo
    }
  }

  const projectPath = project.path ?? safeId;
  const { rows } = await getPool().query<Project>(
    `INSERT INTO projects (id, name, path, git_url, branch, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, path = EXCLUDED.path,
           git_url = EXCLUDED.git_url, branch = EXCLUDED.branch,
           status = EXCLUDED.status
     RETURNING id, name, path, git_url, branch, status,
               registered_at::text AS registered_at`,
    [safeId, project.name, projectPath, project.gitUrl ?? null, project.branch ?? null, project.status ?? 'active']
  );

  await writeAuditLog('project.registered', { projectId: safeId, payload: { name: project.name, gitUrl: project.gitUrl } });

  return rows[0];
}

export async function unregisterProject(projectId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `DELETE FROM projects WHERE id = $1`,
    [projectId]
  );
  if (rowCount && rowCount > 0) {
    await writeAuditLog('project.unregistered', { projectId });
    return true;
  }
  return false;
}

/**
 * Discover projects from sandbox directories and diff with registry.
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
