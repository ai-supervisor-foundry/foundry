import { SupervisorState } from '@/domain/types/types';

export const RedisFixtures = {
  emptyState: (): SupervisorState => ({
    supervisor: { status: 'RUNNING' },
    goal: { description: 'Test Goal', completed: false, project_id: 'test-project' },
    queue: { exhausted: false },
    completed_tasks: [],
    blocked_tasks: [],
    last_updated: new Date().toISOString(),
    execution_mode: 'AUTO',
  }),

  runningState: (): SupervisorState => ({
    supervisor: { status: 'RUNNING', iteration: 5 },
    goal: { description: 'Test Goal', completed: false, project_id: 'test-project' },
    queue: { exhausted: false },
    completed_tasks: [
      {
        task_id: 'task-1',
        completed_at: new Date().toISOString(),
        validation_report: { valid: true, rules_passed: [], rules_failed: [] },
      },
    ],
    blocked_tasks: [],
    last_updated: new Date().toISOString(),
    execution_mode: 'AUTO',
  }),

  completedState: (): SupervisorState => ({
    supervisor: { status: 'COMPLETED', iteration: 10 },
    goal: { description: 'Test Goal', completed: true, project_id: 'test-project' },
    queue: { exhausted: true },
    completed_tasks: [],
    blocked_tasks: [],
    last_updated: new Date().toISOString(),
    execution_mode: 'AUTO',
  }),
};
