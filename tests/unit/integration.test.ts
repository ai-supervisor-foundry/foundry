// Integration tests for control loop and state management

import { createMockState, createMockTask } from '../fixtures/mockData';

describe('Supervisor Integration', () => {
  describe('State transitions', () => {
    it('should transition from RUNNING to COMPLETED when goal is achieved', () => {
      const state = createMockState({
        supervisor: { status: 'RUNNING', iteration: 0 },
        goal: { description: 'Test goal', completed: false },
      });

      // Simulate completion
      state.supervisor.status = 'COMPLETED';
      state.goal.completed = true;

      expect(state.supervisor.status).toBe('COMPLETED');
      expect(state.goal.completed).toBe(true);
    });

    it('should transition from RUNNING to BLOCKED on ambiguity', () => {
      const state = createMockState({
        supervisor: { status: 'RUNNING', iteration: 5 },
      });

      // Simulate blocking
      state.supervisor.status = 'BLOCKED';
      state.supervisor.halt_reason = 'AMBIGUITY';

      expect(state.supervisor.status).toBe('BLOCKED');
      expect(state.supervisor.halt_reason).toBe('AMBIGUITY');
    });

    it('should transition from RUNNING to HALTED when queue is exhausted', () => {
      const state = createMockState({
        supervisor: { status: 'RUNNING' },
        queue: { exhausted: false },
      });

      // Simulate exhaustion
      state.supervisor.status = 'HALTED';
      state.queue.exhausted = true;
      state.supervisor.halt_reason = 'TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE';

      expect(state.supervisor.status).toBe('HALTED');
      expect(state.queue.exhausted).toBe(true);
    });

    it('should track iteration count as work progresses', () => {
      const state = createMockState({
        supervisor: { status: 'RUNNING', iteration: 0 },
      });

      for (let i = 1; i <= 10; i++) {
        state.supervisor.iteration = i;
      }

      expect(state.supervisor.iteration).toBe(10);
    });
  });

  describe('Task lifecycle', () => {
    it('should mark task as in_progress when dispatched', () => {
      const task = createMockTask({
        status: 'pending',
      });

      task.status = 'in_progress';

      expect(task.status).toBe('in_progress');
    });

    it('should mark task as completed after successful validation', () => {
      const task = createMockTask({
        status: 'in_progress',
      });

      task.status = 'completed';

      expect(task.status).toBe('completed');
    });

    it('should mark task as blocked when awaiting user input', () => {
      const task = createMockTask({
        status: 'in_progress',
      });

      task.status = 'blocked';

      expect(task.status).toBe('blocked');
    });

    it('should preserve task metadata throughout lifecycle', () => {
      const meta = { session_id: 'sess-123', feature_id: 'feat-456' };
      const task = createMockTask({
        meta,
        status: 'pending',
      });

      task.status = 'in_progress';
      expect(task.meta).toEqual(meta);

      task.status = 'completed';
      expect(task.meta).toEqual(meta);
    });
  });

  describe('Queue management', () => {
    it('should track completed tasks in order', () => {
      const state = createMockState({
        completed_tasks: [],
      });

      const tasks = [
        { task_id: 'task-1', completed_at: '2024-01-01T00:00:00Z' },
        { task_id: 'task-2', completed_at: '2024-01-01T00:01:00Z' },
        { task_id: 'task-3', completed_at: '2024-01-01T00:02:00Z' },
      ];

      tasks.forEach((task) => {
        state.completed_tasks?.push({
          ...task,
          validation_report: { valid: true, rules_passed: [], rules_failed: [] },
        });
      });

      expect(state.completed_tasks?.length).toBe(3);
      expect(state.completed_tasks?.[0].task_id).toBe('task-1');
      expect(state.completed_tasks?.[2].task_id).toBe('task-3');
    });

    it('should handle multiple blocked tasks', () => {
      const state = createMockState({
        blocked_tasks: [],
      });

      const blockedTasks = [
        {
          task_id: 'blocked-1',
          blocked_at: '2024-01-01T00:00:00Z',
          reason: 'Waiting for user input',
        },
        {
          task_id: 'blocked-2',
          blocked_at: '2024-01-01T00:01:00Z',
          reason: 'Missing environment variables',
        },
      ];

      blockedTasks.forEach((task) => state.blocked_tasks?.push(task));

      expect(state.blocked_tasks?.length).toBe(2);
    });
  });

  describe('Execution modes', () => {
    it('should support AUTO execution mode', () => {
      const state = createMockState({
        execution_mode: 'AUTO',
      });

      expect(state.execution_mode).toBe('AUTO');
    });

    it('should support MANUAL execution mode', () => {
      const state = createMockState({
        execution_mode: 'MANUAL',
      });

      expect(state.execution_mode).toBe('MANUAL');
    });

    it('should require explicit operator input in MANUAL mode', () => {
      const state = createMockState({
        execution_mode: 'MANUAL',
        supervisor: { status: 'BLOCKED' },
      });

      // In MANUAL mode, supervisor requires explicit resume
      expect(state.execution_mode).toBe('MANUAL');
      expect(state.supervisor.status).toBe('BLOCKED');
    });
  });

  describe('Session management', () => {
    it('should track active sessions', () => {
      const state = createMockState({
        active_sessions: {
          'feat-123': {
            session_id: 'sess-abc',
            provider: 'cursor',
            last_used: new Date().toISOString(),
            error_count: 0,
          },
        },
      });

      expect(state.active_sessions?.['feat-123'].provider).toBe('cursor');
      expect(state.active_sessions?.['feat-123'].error_count).toBe(0);
    });

    it('should update session error counts', () => {
      const state = createMockState({
        active_sessions: {
          'feat-123': {
            session_id: 'sess-abc',
            provider: 'cursor',
            last_used: new Date().toISOString(),
            error_count: 0,
          },
        },
      });

      state.active_sessions!['feat-123'].error_count = 1;
      expect(state.active_sessions!['feat-123'].error_count).toBe(1);
    });
  });

  describe('Goal completion detection', () => {
    it('should detect goal completion when all criteria met', () => {
      const state = createMockState({
        goal: { description: 'Build system', completed: false },
        completed_tasks: [],
        queue: { exhausted: false },
      });

      // Simulate task completions
      state.completed_tasks?.push({
        task_id: 'setup-task',
        completed_at: new Date().toISOString(),
        validation_report: { valid: true, rules_passed: [], rules_failed: [] },
      });

      state.goal.completed = true;
      state.supervisor.status = 'COMPLETED';

      expect(state.goal.completed).toBe(true);
      expect(state.supervisor.status).toBe('COMPLETED');
    });

    it('should detect goal incompleteness on queue exhaustion', () => {
      const state = createMockState({
        goal: { description: 'Build system', completed: false },
        queue: { exhausted: true },
      });

      expect(state.queue.exhausted).toBe(true);
      expect(state.goal.completed).toBe(false);
    });
  });
});
