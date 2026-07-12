import { execFile, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const MAX_SANDBOX_PATHS = 200;
const GIT_DIFF_MAX_BUFFER = 10 * 1024 * 1024;

function execGitAsync(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, encoding: 'utf-8', maxBuffer: GIT_DIFF_MAX_BUFFER },
      (err, stdout) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(typeof stdout === 'string' ? stdout : String(stdout ?? ''));
      }
    );
  });
}

export interface GitContext {
  gitRoot: string | null;
  sandboxRel: string;
  changedPaths: string[];
  resolvedAt: string;
}

export function findGitRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    if (current === root) {
      return null;
    }
    current = path.dirname(current);
  }
}

function normalizeGitPath(gitPath: string): string {
  return gitPath.replace(/\\/g, '/');
}

function collectChangedPathsSync(resolvedSandbox: string, gitRoot: string): string[] {
  const sandboxRel = path.relative(gitRoot, resolvedSandbox);
  if (sandboxRel.startsWith('..') || path.isAbsolute(sandboxRel)) {
    return [];
  }

  const prefix =
    sandboxRel === '' || sandboxRel === '.'
      ? ''
      : `${normalizeGitPath(sandboxRel)}/`;
  const normalizedSandboxRel = normalizeGitPath(sandboxRel);

  const opts = { cwd: gitRoot, encoding: 'utf-8' as const, maxBuffer: GIT_DIFF_MAX_BUFFER };
  const working = execSync('git diff --name-only', opts).trim();
  const staged = execSync('git diff --name-only --cached', opts).trim();
  return filterChangedPaths(working, staged, prefix, normalizedSandboxRel);
}

async function collectChangedPathsAsync(resolvedSandbox: string, gitRoot: string): Promise<string[]> {
  const sandboxRel = path.relative(gitRoot, resolvedSandbox);
  if (sandboxRel.startsWith('..') || path.isAbsolute(sandboxRel)) {
    return [];
  }

  const prefix =
    sandboxRel === '' || sandboxRel === '.'
      ? ''
      : `${normalizeGitPath(sandboxRel)}/`;
  const normalizedSandboxRel = normalizeGitPath(sandboxRel);

  const opts = { cwd: gitRoot, encoding: 'utf-8' as const, maxBuffer: GIT_DIFF_MAX_BUFFER };
  const working = await execGitAsync(['diff', '--name-only'], gitRoot);
  const staged = await execGitAsync(['diff', '--name-only', '--cached'], gitRoot);
  return filterChangedPaths(working.trim(), staged.trim(), prefix, normalizedSandboxRel);
}

function filterChangedPaths(
  working: string,
  staged: string,
  prefix: string,
  normalizedSandboxRel: string
): string[] {
  const changed = [
    ...(working ? working.split('\n') : []),
    ...(staged ? staged.split('\n') : []),
  ].filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawPath of changed) {
    const gitPath = normalizeGitPath(rawPath);
    let relativeToSandbox: string | null = null;

    if (prefix === '') {
      relativeToSandbox = gitPath;
    } else if (gitPath === normalizedSandboxRel) {
      relativeToSandbox = null;
    } else if (gitPath.startsWith(prefix)) {
      relativeToSandbox = gitPath.slice(prefix.length);
    }

    if (!relativeToSandbox || seen.has(relativeToSandbox)) {
      continue;
    }

    seen.add(relativeToSandbox);
    result.push(relativeToSandbox);

    if (result.length >= MAX_SANDBOX_PATHS) {
      break;
    }
  }

  return result;
}

function normalizeSandboxRel(sandboxRel: string): string {
  const normalized = normalizeGitPath(sandboxRel);
  return normalized === '.' ? '' : normalized;
}

/**
 * Resolve git root, sandbox-relative prefix, and changed paths for a sandbox cwd.
 * Failure-safe: empty changedPaths when not in a repo or git fails.
 */
export function resolveGitContextSync(sandboxCwd: string): GitContext {
  const resolvedAt = new Date().toISOString();
  try {
    const resolvedSandbox = path.resolve(sandboxCwd);
    const gitRoot = findGitRoot(resolvedSandbox);
    if (!gitRoot) {
      return { gitRoot: null, sandboxRel: '', changedPaths: [], resolvedAt };
    }

    const sandboxRel = normalizeSandboxRel(path.relative(gitRoot, resolvedSandbox));
    if (sandboxRel.startsWith('..') || path.isAbsolute(sandboxRel)) {
      return { gitRoot, sandboxRel, changedPaths: [], resolvedAt };
    }

    return {
      gitRoot,
      sandboxRel,
      changedPaths: collectChangedPathsSync(resolvedSandbox, gitRoot),
      resolvedAt,
    };
  } catch {
    return { gitRoot: null, sandboxRel: '', changedPaths: [], resolvedAt };
  }
}

export async function resolveGitContext(sandboxCwd: string): Promise<GitContext> {
  const resolvedAt = new Date().toISOString();
  try {
    const resolvedSandbox = path.resolve(sandboxCwd);
    const gitRoot = findGitRoot(resolvedSandbox);
    if (!gitRoot) {
      return { gitRoot: null, sandboxRel: '', changedPaths: [], resolvedAt };
    }

    const sandboxRel = normalizeSandboxRel(path.relative(gitRoot, resolvedSandbox));
    if (sandboxRel.startsWith('..') || path.isAbsolute(sandboxRel)) {
      return { gitRoot, sandboxRel, changedPaths: [], resolvedAt };
    }

    return {
      gitRoot,
      sandboxRel,
      changedPaths: await collectChangedPathsAsync(resolvedSandbox, gitRoot),
      resolvedAt,
    };
  } catch {
    return { gitRoot: null, sandboxRel: '', changedPaths: [], resolvedAt };
  }
}
