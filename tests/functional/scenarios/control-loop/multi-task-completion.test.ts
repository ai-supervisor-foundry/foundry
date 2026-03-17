import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

describe('Functional: Control Loop - Multi-Task Completion', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should process multiple tasks sequentially and complete the goal', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Build a complete module with tests', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    // All criteria use "function NAME" pattern which triggers AST heuristic in validator
    const task1 = TaskBuilder.coding('task-m1', 'Create module file')
      .withInstructions('Create math.ts with add and subtract functions.')
      .withCriteria(['function add', 'function subtract'])
      .build();

    const task2 = TaskBuilder.coding('task-m2', 'Create test file')
      .withInstructions('Create math.test.ts with unit tests.')
      .withCriteria(['function testAdd'])
      .build();

    const task3 = TaskBuilder.coding('task-m3', 'Create index barrel')
      .withInstructions('Create index.ts that re-exports math module.')
      .withCriteria(['function reexport'])
      .build();

    await harness.enqueueTasks([task1, task2, task3]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['math.ts'],
      files_updated: [],
      changes: ['Created math.ts with add/subtract'],
      neededChanges: true,
      reasoning: 'Created math module.',
      summary: 'Created math.ts',
    }, {
      'math.ts': 'export function add(a: number, b: number) { return a + b; }\nexport function subtract(a: number, b: number) { return a - b; }',
    });

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['math.test.ts'],
      files_updated: [],
      changes: ['Created math.test.ts'],
      neededChanges: true,
      reasoning: 'Created test file.',
      summary: 'Created math.test.ts',
    }, {
      'math.test.ts': 'function testAdd() { expect(add(1,2)).toBe(3); }\nfunction testSubtract() { expect(subtract(3,1)).toBe(2); }',
    });

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['index.ts'],
      files_updated: [],
      changes: ['Created index.ts barrel'],
      neededChanges: true,
      reasoning: 'Created barrel file.',
      summary: 'Created index.ts',
    }, {
      'index.ts': 'function reexport() { return require("./math"); }',
    });

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'All 3 tasks completed.',
    });

    await harness.runControlLoop(15);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks).toHaveLength(3);

    const completedIds = finalState.completed_tasks.map((t: any) => t.task_id);
    expect(completedIds).toContain('task-m1');
    expect(completedIds).toContain('task-m2');
    expect(completedIds).toContain('task-m3');
    expect(finalState.queue.exhausted).toBe(true);
  });

  it('should track iteration count across multiple tasks', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Quick two-task goal', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    const task1 = TaskBuilder.coding('task-iter1', 'First task')
      .withInstructions('Create file1.ts.')
      .withCriteria(['function initFirst'])
      .build();

    const task2 = TaskBuilder.coding('task-iter2', 'Second task')
      .withInstructions('Create file2.ts.')
      .withCriteria(['function initSecond'])
      .build();

    await harness.enqueueTasks([task1, task2]);

    harness.gemini.pushSuccessResponse({
      status: 'completed', files_created: ['file1.ts'], files_updated: [],
      changes: ['Created file1.ts'], neededChanges: true, reasoning: 'Done.', summary: 'file1.ts',
    }, { 'file1.ts': 'export function initFirst() { return 1; }' });

    harness.gemini.pushSuccessResponse({
      status: 'completed', files_created: ['file2.ts'], files_updated: [],
      changes: ['Created file2.ts'], neededChanges: true, reasoning: 'Done.', summary: 'file2.ts',
    }, { 'file2.ts': 'export function initSecond() { return 2; }' });

    harness.gemini.pushSuccessResponse({
      goal_completed: true, reasoning: 'Both tasks done.',
    });

    await harness.runControlLoop(15);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.supervisor.iteration).toBeGreaterThanOrEqual(2);
    expect(finalState.completed_tasks).toHaveLength(2);
  });
});
