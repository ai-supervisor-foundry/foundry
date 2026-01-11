// Types unit tests

import {
  SupervisorState,
  Task,
  ValidationReport,
  SupervisorStatus,
  TaskType,
} from '../../../src/domain/types/types';
import { Provider } from '../../../src/domain/agents/enums/provider';

describe('Types', () => {
  describe('SupervisorState', () => {
    it('should support RUNNING status', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'RUNNING',
          iteration: 0,
        },
        goal: {
          description: 'Test goal',
          completed: false,
        },
        queue: {
          exhausted: false,
        },
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.supervisor.status).toBe('RUNNING');
    });

    it('should support BLOCKED status', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'BLOCKED',
          iteration: 5,
          halt_reason: 'ASKED_QUESTION',
        },
        goal: {
          description: 'Test goal',
          completed: false,
        },
        queue: {
          exhausted: false,
        },
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.supervisor.status).toBe('BLOCKED');
      expect(state.supervisor.halt_reason).toBe('ASKED_QUESTION');
    });

    it('should support HALTED status', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'HALTED',
          halt_reason: 'TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE',
          halt_details: 'Task list exhausted but goal not achieved',
        },
        goal: {
          description: 'Test goal',
          completed: false,
        },
        queue: {
          exhausted: true,
        },
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.supervisor.status).toBe('HALTED');
      expect(state.queue.exhausted).toBe(true);
    });

    it('should support COMPLETED status', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'COMPLETED',
          iteration: 10,
        },
        goal: {
          description: 'Test goal',
          completed: true,
        },
        queue: {
          exhausted: true,
        },
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.supervisor.status).toBe('COMPLETED');
      expect(state.goal.completed).toBe(true);
    });

    it('should track completed tasks', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'RUNNING',
          iteration: 5,
        },
        goal: {
          description: 'Test goal',
          completed: false,
        },
        queue: {
          exhausted: false,
        },
        completed_tasks: [
          {
            task_id: 'task-1',
            completed_at: '2024-01-01T00:00:00Z',
            intent: 'Initial setup',
            summary: 'Completed: Initial setup',
            requires_context: true,
            validation_report: {
              valid: true,
              rules_passed: ['r1'],
              rules_failed: [],
            },
          },
        ],
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.completed_tasks?.[0].task_id).toBe('task-1');
      expect(state.completed_tasks?.[0].intent).toBe('Initial setup');
      expect(state.completed_tasks?.[0].summary).toBe('Completed: Initial setup');
      expect(state.completed_tasks?.[0].requires_context).toBe(true);
    });

    it('should track blocked tasks', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'BLOCKED',
          iteration: 3,
        },
        goal: {
          description: 'Test goal',
          completed: false,
        },
        queue: {
          exhausted: false,
        },
        blocked_tasks: [
          {
            task_id: 'blocked-task',
            blocked_at: '2024-01-01T00:00:00Z',
            reason: 'Missing environment variables',
          },
        ],
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.blocked_tasks?.[0].task_id).toBe('blocked-task');
    });

    it('should support resource exhaustion retry tracking', () => {
      const state: SupervisorState = {
        supervisor: {
          status: 'RUNNING',
          iteration: 1,
          resource_exhausted_retry: {
            attempt: 1,
            last_attempt_at: '2024-01-01T00:00:00Z',
            next_retry_at: '2024-01-01T00:01:00Z',
          },
        },
        goal: {
          description: 'Test goal',
          completed: false,
        },
        queue: {
          exhausted: false,
        },
        last_updated: new Date().toISOString(),
        execution_mode: 'AUTO',
      };

      expect(state.supervisor.resource_exhausted_retry?.attempt).toBe(1);
    });
  });

  describe('Task', () => {
    it('should support all task types', () => {
      const taskTypes: TaskType[] = [
        'coding',
        'behavioral',
        'configuration',
        'testing',
        'documentation',
        'implementation',
        'refactoring',
      ];

      taskTypes.forEach((type) => {
        const task: Task = {
          task_id: 'test-task',
          intent: 'Test intent',
          tool: Provider.CURSOR,
          task_type: type,
          instructions: 'Test instructions',
          acceptance_criteria: [],
          status: 'pending',
        };

        expect(task.task_type).toBe(type);
      });
    });

    it('should support retry policy', () => {
      const task: Task = {
        task_id: 'test-task',
        intent: 'Test intent',
        tool: Provider.CURSOR,
        instructions: 'Test instructions',
        acceptance_criteria: [],
        status: 'pending',
        retry_policy: {
          max_retries: 2,
          backoff: '5m',
        },
      };

      expect(task.retry_policy?.max_retries).toBe(2);
      expect(task.retry_policy?.backoff).toBe('5m');
    });

    it('should support metadata tracking', () => {
      const task: Task = {
        task_id: 'test-task',
        intent: 'Test intent',
        tool: Provider.CURSOR,
        instructions: 'Test instructions',
        acceptance_criteria: [],
        status: 'pending',
        meta: {
          session_id: 'sess-123',
          feature_id: 'feat-456',
        },
      };

      expect(task.meta?.session_id).toBe('sess-123');
    });

    it('should support task status transitions', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'blocked', 'failed'] as const;

      statuses.forEach((status) => {
        const task: Task = {
          task_id: 'test-task',
          intent: 'Test intent',
          tool: Provider.CURSOR,
          instructions: 'Test instructions',
          acceptance_criteria: [],
          status,
        };

        expect(task.status).toBe(status);
      });
    });

    it('should support working directory override', () => {
      const task: Task = {
        task_id: 'test-task',
        intent: 'Test intent',
        tool: Provider.CURSOR,
        instructions: 'Test instructions',
        acceptance_criteria: [],
        status: 'pending',
        working_directory: 'src/subsystem',
      };

      expect(task.working_directory).toBe('src/subsystem');
    });

    it('should support agent mode override', () => {
      const task: Task = {
        task_id: 'test-task',
        intent: 'Test intent',
        tool: Provider.CURSOR,
        instructions: 'Test instructions',
        acceptance_criteria: [],
        status: 'pending',
        agent_mode: 'opus',
      };

      expect(task.agent_mode).toBe('opus');
    });
  });

  describe('ValidationReport', () => {
    it('should track passed rules', () => {
      const report: ValidationReport = {
        valid: true,
        rules_passed: ['file_exists', 'json_valid', 'schema_match'],
        rules_failed: [],
      };

      expect(report.rules_passed.length).toBe(3);
    });

    it('should track failed rules', () => {
      const report: ValidationReport = {
        valid: false,
        reason: 'Missing required files',
        rules_passed: ['json_valid'],
        rules_failed: ['file_exists', 'schema_match'],
      };

      expect(report.rules_failed.length).toBe(2);
      expect(report.reason).toBe('Missing required files');
    });

    it('should support confidence levels', () => {
      const confidences = ['HIGH', 'LOW', 'UNCERTAIN'] as const;

      confidences.forEach((confidence) => {
        const report: ValidationReport = {
          valid: true,
          rules_passed: [],
          rules_failed: [],
          confidence,
        };

        expect(report.confidence).toBe(confidence);
      });
    });

    it('should track failed criteria', () => {
      const report: ValidationReport = {
        valid: false,
        rules_passed: [],
        rules_failed: [],
        failed_criteria: ['API endpoints', 'Database schema'],
      };

      expect(report.failed_criteria?.length).toBe(2);
    });

    it('should track uncertain criteria', () => {
      const report: ValidationReport = {
        valid: true,
        rules_passed: [],
        rules_failed: [],
        uncertain_criteria: ['Architecture design', 'UI behavior'],
      };

      expect(report.uncertain_criteria?.length).toBe(2);
    });
  });
});
