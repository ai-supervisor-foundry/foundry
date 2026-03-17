import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

describe('Functional: Control Loop - State Persistence', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should persist state after task completion and be reloadable', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Persistence test goal', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-persist-1', 'Create config.ts')
      .withInstructions('Create a config file with loadConfig function.')
      .withCriteria(['function loadConfig'])
      .build();

    await harness.enqueueTasks([task]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['config.ts'],
      files_updated: [],
      changes: ['Created config.ts'],
      neededChanges: true,
      reasoning: 'Created config.',
      summary: 'Created config.ts',
    }, {
      'config.ts': 'export function loadConfig() { return { port: 3000 }; }',
    });

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Config file created.',
    });

    await harness.runControlLoop(10);

    const finalState = await harness.getFinalState();
    expect(finalState).toBeTruthy();
    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.last_updated).toBeDefined();

    // Verify the state can be re-loaded (simulates restart recovery)
    const reloadedState = await harness.getFinalState();
    expect(reloadedState).toEqual(finalState);
  });

  it('should not process tasks when supervisor is HALTED', async () => {
    const haltedState = StateBuilder.halted('Manual operator halt')
      .withGoal('Halted goal', 'test-project')
      .withHaltReason('MANUAL_HALT', 'Operator requested halt')
      .build();

    await harness.loadInitialState(haltedState);

    // Run 3 iterations — should sleep through all since status is HALTED
    await harness.runControlLoop(3);

    const finalState = await harness.getFinalState();
    expect(finalState.supervisor.status).toBe('HALTED');
    expect(finalState.completed_tasks?.length || 0).toBe(0);
  });

  it('should preserve completed_tasks list across iterations', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Incremental progress', 'test-project')
      .withCompletedTasks([{
        task_id: 'task-prev-1',
        completed_at: new Date().toISOString(),
        validation_report: { valid: true, rules_passed: ['exists'], rules_failed: [] },
        intent: 'Previous task',
      }])
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-new-1', 'Create service.ts')
      .withInstructions('Create a service file with class DataService.')
      .withCriteria(['class DataService'])
      .build();

    await harness.enqueueTasks([task]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['service.ts'],
      files_updated: [],
      changes: ['Created service.ts'],
      neededChanges: true,
      reasoning: 'Done.',
      summary: 'Created service.ts',
    }, {
      'service.ts': 'export class DataService { getData() { return []; } }',
    });

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'All tasks done.',
    });

    await harness.runControlLoop(10);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks).toHaveLength(2);
    expect(finalState.completed_tasks[0].task_id).toBe('task-prev-1');
    expect(finalState.completed_tasks[1].task_id).toBe('task-new-1');
  });
});
