// Prompt Builder unit tests

import {
  buildMinimalState,
  buildPrompt,
} from '../../../src/domain/agents/promptBuilder';
import { createMockTask, createMockState } from '../../fixtures/mockData';

describe('PromptBuilder', () => {
  describe('buildPrompt', () => {
    it('should include the mandatory Task ID section', () => {
      const task = createMockTask({ task_id: 'task-123' });
      const state = buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Task ID');
      expect(prompt).toContain('task-123');
    });

    it('should include the consolidated Rules block', () => {
      const task = createMockTask();
      const state = buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Rules');
      expect(prompt).toContain('Use ONLY information from Task Description');
      expect(prompt).toContain('Do NOT paraphrase');
      expect(prompt).toContain('STOP and ask ONE clarifying question');
    });

    it('should include strict Output Requirements with JSON schema', () => {
      const task = createMockTask();
      const state = buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Output Requirements');
      expect(prompt).toContain('Your response MUST end with ONLY this JSON block');
      expect(prompt).toContain('"status": "completed" | "failed"');
      expect(prompt).toContain('"neededChanges": true | false');
      expect(prompt).toContain('"changes": ["relative/path/from/sandbox_root"]');
    });

    it('should include task type guidelines', () => {
      const task = createMockTask({ intent: 'implement auth' });
      const state = buildMinimalState(task, createMockState(), '/tmp');
      const prompt = buildPrompt(task, state);

      expect(prompt).toContain('## Guidelines');
      expect(prompt).toContain('Cover edge cases');
    });
  });

  describe('buildMinimalState', () => {
    it('should include project context', () => {
      const task = createMockTask();
      const state = createMockState();
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.project).toBeDefined();
      expect(minimalState.project.id).toBe('test-project');
      expect(minimalState.project.sandbox_root).toBe(sandboxCwd);
    });

    it('should include goal context when task references goal', () => {
      const task = createMockTask({
        instructions: 'Implement the goal described in the project',
      });
      const state = createMockState({
        goal: {
          description: 'Build a RESTful API',
          completed: false,
          project_id: 'test-project',
        },
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.goal).toBeDefined();
      expect(minimalState.goal?.description).toBe('Build a RESTful API');
    });

    it('should exclude goal context when not relevant', () => {
      const task = createMockTask({
        instructions: 'Create a simple utility function',
      });
      const state = createMockState();
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.goal).toBeUndefined();
    });

    it('should include queue context for dependencies', () => {
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

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.queue).toBeDefined();
      expect(minimalState.queue?.last_task_id).toBe('task-setup-001');
    });

    it('should include completed tasks for extend operations', () => {
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

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
      expect(minimalState.completed_tasks?.length).toBe(2);
    });

    it('should limit completed tasks to last 5', () => {
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

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
      expect(minimalState.completed_tasks?.length).toBe(5);
      // Should include the last 5
      expect(minimalState.completed_tasks?.[0].task_id).toBe('task-5');
      expect(minimalState.completed_tasks?.[4].task_id).toBe('task-9');
    });

    it('should include blocked tasks when relevant', () => {
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

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.blocked_tasks).toBeDefined();
      expect(minimalState.blocked_tasks?.length).toBe(2);
    });

    it('should handle case-insensitive keyword detection', () => {
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

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.completed_tasks).toBeDefined();
    });

    it('should handle tasks with goal prefix', () => {
      const task = createMockTask({
        task_id: 'goal-setup-001',
        instructions: 'Initialize the goal',
      });
      const state = createMockState({
        goal: {
          description: 'Build the system',
          completed: false,
        },
      });
      const sandboxCwd = '/sandbox/test-project';

      const minimalState = buildMinimalState(task, state, sandboxCwd);

      expect(minimalState.goal).toBeDefined();
      expect(minimalState.goal?.description).toBe('Build the system');
    });
  });
});
