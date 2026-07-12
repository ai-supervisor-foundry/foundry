import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

const SESSION_ID = 'sess-reuse-ft-001';
const FEATURE_ID = 'task:task-sess-1';

describe('Functional: Control Loop - Session Reuse', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should persist session_id and pass it to subsequent provider calls', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Create greet function', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-sess-1', 'Create greet.ts')
      .withInstructions('Create greet.ts exporting a greet function.')
      .withCriteria(['function greet'])
      .build();

    await harness.enqueueTasks([task]);

    // 1. Initial execution — valid JSON but file missing greet (validation will fail)
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['wrong.ts'],
      files_updated: [],
      changes: ['Created wrong.ts'],
      neededChanges: true,
      reasoning: 'Created a file.',
      summary: 'Created wrong.ts',
    }, {
      'wrong.ts': 'export const placeholder = true;',
    }, SESSION_ID);

    // 2. Fix retry — should resume SESSION_ID
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['greet.ts'],
      files_updated: [],
      changes: ['Created greet.ts'],
      neededChanges: true,
      reasoning: 'Added greet function.',
      summary: 'Created greet.ts',
    }, {
      'greet.ts': 'export function greet() { return "hello"; }',
    }, SESSION_ID);

    // 3. Retry-task re-execution (if fix validation still fails)
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['greet.ts'],
      files_updated: [],
      changes: ['Created greet.ts'],
      neededChanges: true,
      reasoning: 'Created greet.',
      summary: 'Created greet.ts',
    }, {
      'greet.ts': 'export function greet() { return "hello"; }',
    }, SESSION_ID);

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Greet function created.',
    });

    await harness.runControlLoop(15);

    const providerCalls = harness.gemini.getCallHistory();
    expect(providerCalls.length).toBeGreaterThanOrEqual(2);
    expect(providerCalls[0].sessionId).toBeUndefined();

    const resumedCalls = providerCalls.filter((c) => c.sessionId === SESSION_ID);
    expect(resumedCalls.length).toBeGreaterThanOrEqual(1);

    const finalState = await harness.getFinalState();
    expect(finalState.active_sessions?.[FEATURE_ID]?.session_id).toBe(SESSION_ID);
    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks).toHaveLength(1);
  });

  it('should resolve session from active_sessions on retry_task re-execution', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Create greet function', 'test-project')
      .withActiveSessions({
        [FEATURE_ID]: {
          session_id: SESSION_ID,
          provider: 'gemini',
          last_used: new Date().toISOString(),
          error_count: 0,
          feature_id: FEATURE_ID,
          task_id: 'task-sess-1',
        },
      })
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-sess-1', 'Create greet.ts')
      .withInstructions('Create greet.ts exporting a greet function.')
      .withCriteria(['function greet'])
      .build();

    await harness.enqueueTasks([task]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['greet.ts'],
      files_updated: [],
      changes: ['Created greet.ts'],
      neededChanges: true,
      reasoning: 'Created greet.',
      summary: 'Created greet.ts',
    }, {
      'greet.ts': 'export function greet() { return "hello"; }',
    }, SESSION_ID);

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Done.',
    });

    await harness.runControlLoop(10);

    const providerCalls = harness.gemini.getCallHistory();
    expect(providerCalls.length).toBeGreaterThanOrEqual(1);
    expect(providerCalls[0].sessionId).toBe(SESSION_ID);

    const finalState = await harness.getFinalState();
    expect(finalState.active_sessions?.[FEATURE_ID]?.session_id).toBe(SESSION_ID);
    expect(finalState.supervisor.status).toBe('COMPLETED');
  });
});
