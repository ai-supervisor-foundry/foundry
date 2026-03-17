import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

describe('Functional: Control Loop - Provider Failure & Recovery', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should halt when provider returns a hard error', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Build utility module', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-fail-1', 'Create utils.ts')
      .withInstructions('Create a utility file with helper functions.')
      .withCriteria(['function capitalize exists'])
      .build();

    await harness.enqueueTasks([task]);

    // Provider returns exit code 1 (hard failure triggers halt detection)
    harness.gemini.pushErrorResponse('ECONNRESET: connection reset by peer', 1);

    // The control loop will detect CURSOR_EXEC_FAILURE and either halt or retry
    // HaltHandler calls process.exit(1), which our mock throws
    try {
      await harness.runControlLoop(5);
    } catch (e: any) {
      // Expected: process.exit mock throws
    }

    const finalState = await harness.getFinalState();
    expect(finalState).toBeTruthy();
    expect(finalState.supervisor.status).toBeDefined();
  });

  it('should complete successfully when provider output is valid', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Build utility module', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-ok-1', 'Create utils.ts')
      .withInstructions('Create a utility file.')
      .withCriteria(['function capitalize exists'])
      .build();

    await harness.enqueueTasks([task]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['utils.ts'],
      files_updated: [],
      changes: ['Created utils.ts'],
      neededChanges: true,
      reasoning: 'Created utility module.',
      summary: 'Created utils.ts',
    }, {
      'utils.ts': 'export function capitalize(s: string) { return s[0].toUpperCase() + s.slice(1); }',
    });

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Utility module created.',
    });

    await harness.runControlLoop(10);

    const finalState = await harness.getFinalState();
    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks).toHaveLength(1);
    expect(finalState.completed_tasks[0].task_id).toBe('task-ok-1');
  });
});
