import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { createMockTask, createMockState } from '../../fixtures/mockData';
import {
  bumpGitContextExecutionSeq,
  buildGitContextCacheKey,
  resolveGitContextForTask,
} from '../../../src/infrastructure/connectors/git/gitContextCache';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
  execFile: jest.fn(),
}));

function makeTempGitSandbox(sandboxRelPath: string): { sandboxCwd: string; cleanup: () => void } {
  const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-git-'));
  fs.mkdirSync(path.join(gitRoot, '.git'));
  const sandboxCwd = path.join(gitRoot, sandboxRelPath);
  fs.mkdirSync(sandboxCwd, { recursive: true });
  return { sandboxCwd, cleanup: () => fs.rmSync(gitRoot, { recursive: true, force: true }) };
}

describe('gitContextCache', () => {
  const execFileMock = () => child_process.execFile as unknown as jest.Mock;

  beforeEach(() => {
    execFileMock().mockImplementation((_file, args, _opts, callback) => {
      const cmd = (args as string[]).join(' ');
      if (cmd === 'diff --name-only') {
        callback(null, 'sandbox/proj/src/a.ts\n', '');
        return;
      }
      if (cmd === 'diff --name-only --cached') {
        callback(null, '', '');
        return;
      }
      callback(null, '', '');
    });
  });

  afterEach(() => {
    execFileMock().mockReset();
  });

  it('buildGitContextCacheKey includes retry, seq, and cwd', () => {
    expect(buildGitContextCacheKey(1, 2, '/tmp/wt')).toBe('1:2:/tmp/wt');
  });

  it('reuses cached git context for same retry and execution seq', async () => {
    const task = createMockTask({ task_id: 'cache-hit' });
    const { sandboxCwd, cleanup } = makeTempGitSandbox('sandbox/proj');
    const state = createMockState({
      active_tasks: {
        'cache-hit': {
          task,
          worker_id: 'main',
          started_at: new Date().toISOString(),
          git_execution_seq: 0,
        },
      },
    });

    const first = await resolveGitContextForTask(state, task, sandboxCwd);
    const second = await resolveGitContextForTask(state, task, sandboxCwd);

    expect(first.changedPaths).toEqual(['src/a.ts']);
    expect(second).toBe(first);
    expect(execFileMock()).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('invalidates cache after execution seq bump (post-agent edits)', async () => {
    const task = createMockTask({ task_id: 'cache-bump' });
    const { sandboxCwd, cleanup } = makeTempGitSandbox('sandbox/proj');
    const state = createMockState({
      active_tasks: {
        'cache-bump': {
          task,
          worker_id: 'main',
          started_at: new Date().toISOString(),
          git_execution_seq: 0,
        },
      },
    });

    await resolveGitContextForTask(state, task, sandboxCwd);
    bumpGitContextExecutionSeq(state, 'cache-bump');

    execFileMock().mockImplementation((_file, args, _opts, callback) => {
      const cmd = (args as string[]).join(' ');
      if (cmd === 'diff --name-only') {
        callback(null, 'sandbox/proj/src/b.ts\n', '');
        return;
      }
      callback(null, '', '');
    });

    const afterBump = await resolveGitContextForTask(state, task, sandboxCwd);
    expect(afterBump.changedPaths).toEqual(['src/b.ts']);
    expect(execFileMock()).toHaveBeenCalledTimes(4);

    cleanup();
  });
});
