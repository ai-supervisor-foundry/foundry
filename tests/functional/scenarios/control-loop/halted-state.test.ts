import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

describe('Functional: Control Loop - Halted & Completed States', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should not process tasks when supervisor is HALTED', async () => {
    const haltedState = StateBuilder.halted('TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE')
      .withGoal('Incomplete goal', 'test-project')
      .withHaltReason('TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE', 'Queue empty but goal not met')
      .build();

    await harness.loadInitialState(haltedState);

    const task = TaskBuilder.coding('task-halted-1', 'Should not run')
      .withInstructions('This should never execute.')
      .withCriteria(['should not happen'])
      .build();

    await harness.enqueueTasks([task]);

    await harness.runControlLoop(3);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('HALTED');
    expect(finalState.completed_tasks?.length || 0).toBe(0);
    expect(harness.gemini.getCallHistory()).toHaveLength(0);
  });

  it('should not process tasks when supervisor is COMPLETED', async () => {
    const completedState = StateBuilder.empty()
      .withStatus('COMPLETED')
      .withGoal('Finished goal', 'test-project')
      .withGoalCompleted(true, 'test-project')
      .build();

    await harness.loadInitialState(completedState);

    const task = TaskBuilder.coding('task-completed-1', 'Should not run')
      .withInstructions('This should never execute.')
      .withCriteria(['should not happen'])
      .build();

    await harness.enqueueTasks([task]);

    await harness.runControlLoop(3);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks?.length || 0).toBe(0);
    expect(harness.gemini.getCallHistory()).toHaveLength(0);
  });

  it('should halt when queue is exhausted but goal is incomplete', async () => {
    const initialState = StateBuilder.running()
      .withGoal('An unachievable goal without more tasks', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    // No tasks enqueued — queue is empty from the start

    // Goal completion check returns false — halt handler will call process.exit
    harness.gemini.pushSuccessResponse({
      goal_completed: false,
      reasoning: 'No work has been done toward the goal.',
    });

    // The control loop will call process.exit(1) via HaltHandler,
    // which our setup.ts mock converts to a thrown error
    await expect(harness.runControlLoop(5)).rejects.toThrow('process.exit');

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('HALTED');
    expect(finalState.supervisor.halt_reason).toBeDefined();
  });
});
