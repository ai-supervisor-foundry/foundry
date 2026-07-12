// Persistence layer unit tests

import { loadState, persistState } from '../../../src/application/services/persistence';
import { createMockState } from '../../fixtures/mockData';
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const flushPromises = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function waitForFile(filePath: string, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await flushPromises();
    }
  }
  throw new Error(`Timed out waiting for file: ${filePath}`);
}

describe('Persistence', () => {
  let mockRedis: jest.Mocked<Redis>;
  let sandboxRoot: string;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    delete process.env.SANDBOX_ROOT;
    sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'persistence-test-'));
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    mockRedis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn(),
    } as any;
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await fs.rm(sandboxRoot, { recursive: true, force: true });
  });

  describe('persistState', () => {
    it('should serialize and store state', async () => {
      const state = createMockState();
      const stateKey = 'supervisor:state';

      mockRedis.set.mockResolvedValue('OK');

      await persistState(mockRedis, stateKey, state);

      expect(mockRedis.set).toHaveBeenCalledWith(stateKey, JSON.stringify(state));
    });

    it('should handle complex state with nested objects', async () => {
      const state = createMockState({
        completed_tasks: [
          {
            task_id: 'task-1',
            completed_at: new Date().toISOString(),
            validation_report: {
              valid: true,
              rules_passed: ['rule1', 'rule2'],
              rules_failed: [],
              confidence: 'HIGH',
            },
          },
        ],
      });
      const stateKey = 'supervisor:state';

      mockRedis.set.mockResolvedValue('OK');

      await persistState(mockRedis, stateKey, state);

      const callArgs = (mockRedis.set).mock.calls[0];
      const storedJson = callArgs[1] as string;
      const parsedState = JSON.parse(storedJson);

      expect(parsedState.completed_tasks[0].task_id).toBe('task-1');
      expect(parsedState.completed_tasks[0].validation_report.valid).toBe(true);
    });

    it('should update last_updated timestamp', async () => {
      const state = createMockState();
      const stateKey = 'supervisor:state';
      const beforeTime = new Date();

      mockRedis.set.mockResolvedValue('OK');

      await persistState(mockRedis, stateKey, state);

      const callArgs = (mockRedis.set).mock.calls[0];
      const storedJson = callArgs[1] as string;
      const parsedState = JSON.parse(storedJson);
      const lastUpdated = new Date(parsedState.last_updated);

      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });

    it('should preserve execution_mode', async () => {
      const state = createMockState({ execution_mode: 'MANUAL' });
      const stateKey = 'supervisor:state';

      mockRedis.set.mockResolvedValue('OK');

      await persistState(mockRedis, stateKey, state);

      const callArgs = (mockRedis.set).mock.calls[0];
      const storedJson = callArgs[1] as string;
      const parsedState = JSON.parse(storedJson);

      expect(parsedState.execution_mode).toBe('MANUAL');
    });

    it('should preserve supervisor status transitions', async () => {
      const state = createMockState({
        supervisor: {
          status: 'BLOCKED',
          iteration: 5,
          halt_reason: 'ASKED_QUESTION',
        },
      });
      const stateKey = 'supervisor:state';

      mockRedis.set.mockResolvedValue('OK');

      await persistState(mockRedis, stateKey, state);

      const callArgs = (mockRedis.set).mock.calls[0];
      const storedJson = callArgs[1] as string;
      const parsedState = JSON.parse(storedJson);

      expect(parsedState.supervisor.status).toBe('BLOCKED');
      expect(parsedState.supervisor.halt_reason).toBe('ASKED_QUESTION');
    });

    it('should async write state.json fallback without blocking Redis SET', async () => {
      const state = createMockState();
      const stateKey = 'supervisor:state';

      await persistState(mockRedis, stateKey, state, sandboxRoot);
      const fallbackPath = path.join(sandboxRoot, 'state.json');
      await waitForFile(fallbackPath);
      const fallbackContent = await fs.readFile(fallbackPath, 'utf8');
      const parsedFallback = JSON.parse(fallbackContent);

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(parsedFallback.supervisor.status).toBe(state.supervisor.status);
      expect(parsedFallback.last_updated).toBeDefined();
    });
  });

  describe('loadState', () => {
    it('should deserialize stored state', async () => {
      const state = createMockState();
      const stateKey = 'supervisor:state';

      mockRedis.get.mockResolvedValue(JSON.stringify(state));

      const loaded = await loadState(mockRedis, stateKey);

      expect(loaded).toEqual(state);
      expect(mockRedis.get).toHaveBeenCalledWith(stateKey);
    });

    it('should throw error on missing state', async () => {
      const stateKey = 'supervisor:state';

      mockRedis.get.mockResolvedValue(null);

      await expect(loadState(mockRedis, stateKey)).rejects.toThrow();
    });

    it('should load from state.json when Redis returns null', async () => {
      const state = createMockState({ supervisor: { status: 'HALTED', iteration: 3 } });
      const stateKey = 'supervisor:state';
      const fallbackPath = path.join(sandboxRoot, 'state.json');

      await fs.mkdir(sandboxRoot, { recursive: true });
      await fs.writeFile(fallbackPath, JSON.stringify(state), 'utf8');
      mockRedis.get.mockResolvedValue(null);

      const loaded = await loadState(mockRedis, stateKey, sandboxRoot);

      expect(loaded.supervisor.status).toBe('HALTED');
      expect(loaded.supervisor.iteration).toBe(3);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OPERATOR WARNING]')
      );
    });

    it('should load from state.json when Redis GET throws', async () => {
      const state = createMockState({ supervisor: { status: 'RUNNING', iteration: 7 } });
      const stateKey = 'supervisor:state';
      const fallbackPath = path.join(sandboxRoot, 'state.json');

      await fs.mkdir(sandboxRoot, { recursive: true });
      await fs.writeFile(fallbackPath, JSON.stringify(state), 'utf8');
      mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));

      const loaded = await loadState(mockRedis, stateKey, sandboxRoot);

      expect(loaded.supervisor.iteration).toBe(7);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('state.json')
      );
    });

    it('should throw when Redis and state.json fallback are unavailable', async () => {
      const stateKey = 'supervisor:state';

      mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));

      await expect(loadState(mockRedis, stateKey, sandboxRoot)).rejects.toThrow(
        'Failed to load state from Redis'
      );
    });

    it('should throw error on invalid JSON', async () => {
      const stateKey = 'supervisor:state';

      mockRedis.get.mockResolvedValue('invalid json');

      await expect(loadState(mockRedis, stateKey)).rejects.toThrow();
    });

    it('should preserve all state properties on load', async () => {
      const state = createMockState({
        supervisor: {
          status: 'RUNNING',
          iteration: 10,
          last_task_id: 'task-123',
        },
        completed_tasks: [
          {
            task_id: 'task-1',
            completed_at: '2024-01-01T00:00:00Z',
            validation_report: {
              valid: true,
              rules_passed: ['r1'],
              rules_failed: [],
            },
          },
        ],
      });
      const stateKey = 'supervisor:state';

      mockRedis.get.mockResolvedValue(JSON.stringify(state));

      const loaded = await loadState(mockRedis, stateKey);

      expect(loaded.supervisor.status).toBe('RUNNING');
      expect(loaded.supervisor.iteration).toBe(10);
      expect(loaded.supervisor.last_task_id).toBe('task-123');
      expect(loaded.completed_tasks?.[0].task_id).toBe('task-1');
    });

    it('should handle goal transitions', async () => {
      const state = createMockState({
        goals: {
          'proj-1': {
            description: 'Complete feature X',
            completed: true,
            project_id: 'proj-1',
          },
        },
      });
      const stateKey = 'supervisor:state';

      mockRedis.get.mockResolvedValue(JSON.stringify(state));

      const loaded = await loadState(mockRedis, stateKey);

      expect(loaded.goals['proj-1'].completed).toBe(true);
      expect(loaded.goals['proj-1'].description).toBe('Complete feature X');
      expect(loaded.goals['proj-1'].project_id).toBe('proj-1');
    });

    it('should backfill missing intent for legacy completed tasks', async () => {
      const legacyState = {
        supervisor: { status: 'RUNNING', iteration: 1 },
        goal: { description: 'test', completed: false },
        queue: { exhausted: false },
        completed_tasks: [
          {
            task_id: 'legacy-task-1',
            completed_at: '2024-01-01T00:00:00Z',
            validation_report: { valid: true, rules_passed: [], rules_failed: [] },
          },
        ],
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      } as any;
      const stateKey = 'supervisor:state';

      mockRedis.get.mockResolvedValue(JSON.stringify(legacyState));

      const loaded = await loadState(mockRedis, stateKey);

      expect(loaded.completed_tasks?.[0].intent).toBe('[Legacy] legacy-task-1');
      expect(loaded.completed_tasks?.[0].requires_context).toBe(false);
    });
  });

  describe('State persistence round-trip', () => {
    it('should maintain state integrity through persist/load cycle', async () => {
      const original = createMockState({
        supervisor: { status: 'RUNNING', iteration: 42 },
        goals: { 'test-project': { description: 'Test goal', completed: false, project_id: 'test-project' } },
      });
      const stateKey = 'supervisor:state';

      // Persist
      mockRedis.set.mockResolvedValue('OK');
      await persistState(mockRedis, stateKey, original);

      // Load
      const persisted = (mockRedis.set).mock.calls[0][1] as string;
      mockRedis.get.mockResolvedValue(persisted);
      const loaded = await loadState(mockRedis, stateKey);

      expect(loaded.supervisor.status).toBe(original.supervisor.status);
      expect(loaded.supervisor.iteration).toBe(original.supervisor.iteration);
      expect(loaded.goals['test-project'].description).toBe(original.goals['test-project'].description);
      expect(loaded.execution_mode).toBe(original.execution_mode);
    });
  });
});
