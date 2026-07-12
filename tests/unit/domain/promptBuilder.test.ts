// Prompt Builder unit tests

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import {
  buildMinimalState,
  buildPrompt,
  buildGoalCompletionPrompt,
  getGitChangedSandboxPaths,
} from '../../../src/domain/agents/promptBuilder';
import { createMockTask, createMockState } from '../../fixtures/mockData';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
  execFile: jest.fn(),
}));

function wireExecFileFromExecSync(): void {
  const execSyncMock = child_process.execSync as unknown as jest.Mock;
  const execFileMock = child_process.execFile as unknown as jest.Mock;
  execFileMock.mockImplementation((file, args, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? undefined : options;
    try {
      const stdout = execSyncMock(`git ${(args as string[]).join(' ')}`, opts);
      cb(null, stdout, '');
    } catch (err) {
      cb(err);
    }
  });
}

function defaultExecFileEmpty(): void {
  const execFileMock = child_process.execFile as unknown as jest.Mock;
  execFileMock.mockImplementation((file, args, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    cb(null, '', '');
  });
}

function makeTempGitSandbox(sandboxRelPath: string): { sandboxCwd: string; cleanup: () => void } {
  const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-git-'));
  fs.mkdirSync(path.join(gitRoot, '.git'));
  const sandboxCwd = path.join(gitRoot, sandboxRelPath);
  fs.mkdirSync(sandboxCwd, { recursive: true });
  return {
    sandboxCwd,
    cleanup: () => fs.rmSync(gitRoot, { recursive: true, force: true }),
  };
}

describe('PromptBuilder', () => {
  beforeEach(() => {
    defaultExecFileEmpty();
  });

  describe('buildPrompt', () => {
    it('should include the mandatory Task ID section', async () => {
      const task = createMockTask({ task_id: 'task-123' });
      const state = await buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Task ID');
      expect(prompt).toContain('task-123');
    });

    it('should include the consolidated Rules block', async () => {
      const task = createMockTask();
      const state = await buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Rules');
      expect(prompt).toContain('Use ONLY information from Task Description');
      expect(prompt).toContain('Do NOT paraphrase');
      expect(prompt).toContain('STOP and ask ONE clarifying question');
    });

    it('should include strict Output Requirements with JSON schema', async () => {
      const task = createMockTask();
      const state = await buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Output Requirements');
      expect(prompt).toContain('Your response MUST end with ONLY this JSON block');
      expect(prompt).toContain('"status": "completed" | "failed"');
      expect(prompt).toContain('"neededChanges": true | false');
      expect(prompt).toContain('"changes": ["relative/path/from/sandbox_root"]');
    });

    it('should include task type guidelines', async () => {
      const task = createMockTask({ intent: 'implement auth' });
      const state = await buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Guidelines');
      expect(prompt).toContain('Cover edge cases');
    });
  });

  describe('buildMinimalState', () => {
    it('should include project context', async () => {
      const task = createMockTask();
      const state = createMockState();
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.project).toBeDefined();
      expect(minimalState.project.id).toBe('test-project');
      expect(minimalState.project.sandbox_root).toBe(sandboxCwd);
    });

    it('should include goal context when task references goal', async () => {
      const task = createMockTask({
        instructions: 'Implement the goal described in the project',
      });
      const state = createMockState({
        goals: {
          'test-project': { description: 'Build a RESTful API', completed: false, project_id: 'test-project' },
        },
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.goal).toBeDefined();
      expect(minimalState.goal?.description).toBe('Build a RESTful API');
    });

    it('should exclude goal context when not relevant', async () => {
      const task = createMockTask({
        instructions: 'Create a simple utility function',
      });
      const state = createMockState();
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.goal).toBeUndefined();
    });

    it('should include queue context for dependencies', async () => {
      const task = createMockTask({
        instructions: 'Build on the previous implementation from earlier tasks',
      });
      const state = createMockState({
        supervisor: {
          status: 'RUNNING',
          iteration: 5,
          last_task_id: 'task-setup-001',
        },
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.queue).toBeDefined();
      expect(minimalState.queue?.last_task_id).toBe('task-setup-001');
    });

    it('should include completed tasks for extend operations', async () => {
      const task = createMockTask({
        instructions: 'Extend the previous implementation',
      });
      const state = createMockState({
        completed_tasks: [
          {
            task_id: 'task-1',
            completed_at: new Date().toISOString(),
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
          {
            task_id: 'task-2',
            completed_at: new Date().toISOString(),
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
        ],
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
      expect(minimalState.completed_tasks?.length).toBe(2);
    });

    it('should limit completed tasks to last 5', async () => {
      const task = createMockTask({
        instructions: 'Build on previous implementations',
      });
      
      const completedTasks = Array.from({ length: 10 }, (_, i) => ({
        task_id: `task-${i}`,
        completed_at: new Date().toISOString(),
        validation_report: { valid: true, rules_passed: [], rules_failed: [] },
      }));

      const state = createMockState({ completed_tasks: completedTasks });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
      expect(minimalState.completed_tasks?.length).toBe(5);
      // Should include the last 5
      expect(minimalState.completed_tasks?.[0].task_id).toBe('task-5');
      expect(minimalState.completed_tasks?.[4].task_id).toBe('task-9');
    });

    it('should include blocked tasks when relevant', async () => {
      const task = createMockTask({
        instructions: 'Unblock the deployment process',
      });
      const state = createMockState({
        blocked_tasks: [
          {
            task_id: 'deploy-1',
            blocked_at: new Date().toISOString(),
            reason: 'Missing environment variables',
          },
          {
            task_id: 'deploy-2',
            blocked_at: new Date().toISOString(),
            reason: 'Configuration incomplete',
          },
        ],
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.blocked_tasks).toBeDefined();
      expect(minimalState.blocked_tasks?.length).toBe(2);
    });

    it('should handle case-insensitive keyword detection', async () => {
      const task = createMockTask({
        intent: 'EXTEND THE SYSTEM',
        instructions: 'BUILD ON PREVIOUS IMPLEMENTATIONS',
      });
      const state = createMockState({
        completed_tasks: [
          {
            task_id: 'task-1',
            completed_at: new Date().toISOString(),
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
        ],
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
    });

    it('should handle tasks with goal prefix', async () => {
      const task = createMockTask({
        task_id: 'goal-setup-001',
        instructions: 'Initialize the goal',
      });
      const state = createMockState({
        goals: {
          'test-project': { description: 'Build the system', completed: false, project_id: 'test-project' },
        },
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.goal).toBeDefined();
      expect(minimalState.goal?.description).toBe('Build the system');
    });

    it('should include the last completed task even without keywords (Recency Bias)', async () => {
      const task = createMockTask({
        instructions: 'Do something unrelated',
      });
      const state = createMockState({
        completed_tasks: [
          {
            task_id: 'task-1',
            completed_at: new Date().toISOString(),
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
          {
            task_id: 'task-2',
            completed_at: new Date().toISOString(),
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
        ],
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
      expect(minimalState.completed_tasks?.length).toBe(1);
      expect(minimalState.completed_tasks?.[0].task_id).toBe('task-2');
    });

    it('should ALWAYS include recent_completed_tasks with intents', async () => {
      const task = createMockTask();
      const state = createMockState({
        completed_tasks: [
          {
            task_id: 't1',
            completed_at: '2024-01-01',
            intent: 'Setup DB',
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
          {
            task_id: 't2',
            completed_at: '2024-01-02',
            intent: 'Create API',
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
        ],
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.recent_completed_tasks).toBeDefined();
      expect(minimalState.recent_completed_tasks).toHaveLength(2);
      expect(minimalState.recent_completed_tasks![0].intent).toBe('Setup DB');
      expect(minimalState.recent_completed_tasks![1].intent).toBe('Create API');
    });

    it('should ALWAYS include active_blockers', async () => {
      const task = createMockTask();
      const state = createMockState({
        blocked_tasks: [
          {
            task_id: 'b1',
            reason: 'Missing API key',
            blocked_at: '2024-01-01',
          },
        ],
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = await buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.active_blockers).toBeDefined();
      expect(minimalState.active_blockers).toHaveLength(1);
      expect(minimalState.active_blockers![0].reason).toBe('Missing API key');
    });

    it('should include file_paths from git-changed sandbox files', async () => {
      const execFileMock = child_process.execFile as unknown as jest.Mock;
      const { sandboxCwd, cleanup } = makeTempGitSandbox('sandbox/test-project');

      execFileMock.mockImplementation((_file, args, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        const cmd = (args as string[]).join(' ');
        if (cmd === 'diff --name-only') {
          cb(null, 'sandbox/test-project/src/index.ts\nother-project/file.ts\n', '');
          return;
        }
        if (cmd === 'diff --name-only --cached') {
          cb(null, 'sandbox/test-project/package.json\nsandbox/test-project/src/index.ts\n', '');
          return;
        }
        cb(null, '', '');
      });

      const task = createMockTask();
      const minimalState = await buildMinimalState(task, createMockState(), sandboxCwd);

      expect(minimalState.file_paths).toEqual(['src/index.ts', 'package.json']);

      cleanup();
      execFileMock.mockReset();
    });

    it('should default file_paths to empty array when git is unavailable', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-nogit-'));

      const task = createMockTask();
      const minimalState = await buildMinimalState(task, createMockState(), tmpDir);

      expect(minimalState.file_paths).toEqual([]);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });


    it('returns [] when no git root is found', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-nogit-'));

      expect(getGitChangedSandboxPaths(tmpDir)).toEqual([]);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns [] when git commands fail', async () => {
      const { sandboxCwd, cleanup } = makeTempGitSandbox('sandbox/test-project');
      const execSyncMock = child_process.execSync as unknown as jest.Mock;
      execSyncMock.mockImplementation(() => {
        throw new Error('git not installed');
      });
      wireExecFileFromExecSync();

      expect(getGitChangedSandboxPaths(sandboxCwd)).toEqual([]);

      cleanup();
    });

    it('filters, dedupes, and strips paths relative to sandbox root', async () => {
      const { sandboxCwd, cleanup } = makeTempGitSandbox('sandbox/test-project');
      const execSyncMock = child_process.execSync as unknown as jest.Mock;
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === 'git diff --name-only') {
          return [
            'sandbox/test-project/src/index.ts',
            'sandbox/other-project/ignored.ts',
            'sandbox/test-project/README.md',
          ].join('\n');
        }
        if (cmd === 'git diff --name-only --cached') {
          return 'sandbox/test-project/src/index.ts\nsandbox/test-project/package.json';
        }
        return '';
      });
      wireExecFileFromExecSync();

      expect(getGitChangedSandboxPaths(sandboxCwd)).toEqual([
        'src/index.ts',
        'README.md',
        'package.json',
      ]);

      cleanup();
    });

    it('caps results at 200 paths', async () => {
      const { sandboxCwd, cleanup } = makeTempGitSandbox('sandbox/test-project');
      const manyPaths = Array.from({ length: 250 }, (_, i) => `sandbox/test-project/file-${i}.ts`).join('\n');
      const execSyncMock = child_process.execSync as unknown as jest.Mock;
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd === 'git diff --name-only') {
          return manyPaths;
        }
        return '';
      });
      wireExecFileFromExecSync();

      expect(getGitChangedSandboxPaths(sandboxCwd)).toHaveLength(200);

      cleanup();
    });
  });

  describe('buildGoalCompletionPrompt', () => {
    it('should list project paths relative to sandbox root', async () => {
      const state = createMockState({
        goals: {
          'easeclassifieds': {
            description: 'Build frontend',
            completed: false,
            project_id: 'easeclassifieds',
          },
          'easeclassifieds-api': {
            description: 'Build backend',
            completed: false,
            project_id: 'easeclassifieds-api',
          },
        },
      });
      const sandboxRoot = '/sandbox';

      const prompt = buildGoalCompletionPrompt(state, sandboxRoot);

      expect(prompt).toContain('## Project Structure');
      expect(prompt).toContain('- ./easeclassifieds/');
      expect(prompt).toContain('- ./easeclassifieds-api/');
      expect(prompt).not.toContain(`${sandboxRoot}/easeclassifieds`);
    });

    it('should not include hardcoded easeclassifieds paths when goals differ', async () => {
      const state = createMockState({
        goals: {
          'my-frontend': {
            description: 'Build UI',
            completed: false,
            project_id: 'my-frontend',
          },
        },
      });

      const prompt = buildGoalCompletionPrompt(state, '/sandbox');

      expect(prompt).toContain('- ./my-frontend/');
      expect(prompt).not.toContain('easeclassifieds');
    });
  });
});
