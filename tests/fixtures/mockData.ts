// Test fixtures for supervisor state and tasks

import { SupervisorState, Task, ValidationReport } from '../../src/domain/types/types';
import { Provider } from '../../src/domain/agents/enums/provider';

export const createMockTask = (overrides?: Partial<Task>): Task => ({
  task_id: 'test-task-001',
  intent: 'Test implementation',
  tool: Provider.CURSOR,
  task_type: 'coding',
  instructions: 'Create a test function that validates input parameters.',
  acceptance_criteria: [
    'Function must accept parameters',
    'Function must validate input',
    'Function must return boolean',
  ],
  status: 'pending',
  retry_policy: {
    max_retries: 2,
  },
  ...overrides,
});

export const createMockState = (overrides?: Partial<SupervisorState>): SupervisorState => ({
  supervisor: {
    status: 'RUNNING',
    iteration: 0,
    last_task_id: undefined,
  },
  goal: {
    description: 'Build a test module',
    completed: false,
    project_id: 'test-project',
  },
  queue: {
    exhausted: false,
  },
  last_updated: new Date().toISOString(),
  execution_mode: 'AUTO',
  completed_tasks: [],
  blocked_tasks: [],
  ...overrides,
});

export const createMockValidationReport = (
  overrides?: Partial<ValidationReport>
): ValidationReport => ({
  valid: true,
  rules_passed: ['file_exists', 'json_valid'],
  rules_failed: [],
  confidence: 'HIGH',
  ...overrides,
});
