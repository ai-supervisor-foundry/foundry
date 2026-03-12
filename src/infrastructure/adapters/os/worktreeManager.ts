// Git Worktree Manager
// Creates/merges/removes git worktrees for per-worker task isolation.

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [WorktreeManager] ${message}`, data ? JSON.stringify(data) : '');
}

export class WorktreeManager {
  constructor(private sandboxRoot: string) {}

  /**
   * Check if a project directory is a git repo.
   */
  async isGitRepo(projectId: string): Promise<boolean> {
    const projectPath = path.join(this.sandboxRoot, projectId);
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: projectPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a git worktree for a task.
   * Returns the worktree path.
   * If the project is not a git repo, returns the project path directly (no isolation).
   */
  async create(projectId: string, taskId: string, workerId: string): Promise<string> {
    const projectPath = path.join(this.sandboxRoot, projectId);
    const isGit = await this.isGitRepo(projectId);

    if (!isGit) {
      log('Not a git repo, using direct path', { projectId });
      return projectPath;
    }

    const worktreesDir = path.join(projectPath, '.worktrees');
    await fs.mkdir(worktreesDir, { recursive: true });

    const branchName = `worker-${workerId}-${taskId}`;
    const worktreePath = path.join(worktreesDir, `${workerId}-${taskId}`);

    try {
      await execAsync(
        `git worktree add "${worktreePath}" -b "${branchName}"`,
        { cwd: projectPath }
      );
      log('Worktree created', { projectId, taskId, workerId, worktreePath, branchName });
      return worktreePath;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log('Worktree creation failed, falling back to direct path', {
        projectId, taskId, workerId, error: msg,
      });
      return projectPath;
    }
  }

  /**
   * Merge worktree branch back to the main branch and remove the worktree.
   */
  async mergeAndRemove(worktreePath: string, projectId: string): Promise<void> {
    const projectPath = path.join(this.sandboxRoot, projectId);

    // Extract branch name from worktree
    let branchName: string | null = null;
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: worktreePath });
      branchName = stdout.trim();
    } catch {
      log('Could not determine worktree branch', { worktreePath });
    }

    // Remove worktree first
    try {
      await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: projectPath });
      log('Worktree removed', { worktreePath });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log('Worktree removal failed', { worktreePath, error: msg });
    }

    // Merge branch if we found one
    if (branchName && branchName !== 'HEAD') {
      try {
        await execAsync(`git merge "${branchName}" --no-edit`, { cwd: projectPath });
        log('Branch merged', { branchName, projectId });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log('Branch merge failed', { branchName, projectId, error: msg });
        throw new Error(`Merge conflict for branch ${branchName}: ${msg}`);
      }

      // Clean up the branch
      try {
        await execAsync(`git branch -d "${branchName}"`, { cwd: projectPath });
      } catch {
        // Branch may already be deleted
      }
    }
  }

  /**
   * Remove a worktree without merging (on task failure).
   */
  async remove(worktreePath: string): Promise<void> {
    try {
      // Get branch name before removing
      let branchName: string | null = null;
      try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: worktreePath });
        branchName = stdout.trim();
      } catch {
        // Ignore
      }

      // Find the parent repo by going up from the worktree
      const parentPath = path.dirname(path.dirname(worktreePath)); // .worktrees/.. = project root
      await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: parentPath });
      log('Worktree removed (no merge)', { worktreePath });

      // Delete the branch
      if (branchName && branchName !== 'HEAD') {
        try {
          await execAsync(`git branch -D "${branchName}"`, { cwd: parentPath });
        } catch {
          // Branch may already be deleted
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log('Worktree removal failed', { worktreePath, error: msg });
      // Try cleanup via filesystem as fallback
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    }
  }
}
