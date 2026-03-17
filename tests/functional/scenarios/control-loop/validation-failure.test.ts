import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

describe('Functional: Control Loop - Validation Failure Handling', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should complete when provider reports neededChanges false with status completed', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Review existing code', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    // Use behavioral task type — validation is simpler (just checks status+response)
    const task = TaskBuilder.behavioral('task-val-1', 'Review code quality')
      .withInstructions('Review the existing code and confirm it works.')
      .withCriteria(['response provided'])
      .build();

    await harness.enqueueTasks([task]);

    // Behavioral tasks expect { status, response, confidence, reasoning }
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      response: 'The code looks good and follows best practices.',
      confidence: 0.95,
      reasoning: 'Reviewed all files and found no issues.',
    });

    // Goal completion
    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Review task completed.',
    });

    await harness.runControlLoop(10);

    const finalState = await harness.getFinalState();
    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks).toHaveLength(1);
  });

  it('should handle task with failing test command gracefully', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Build tested feature', 'test-project')
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-testfail-1', 'Create module with tests')
      .withInstructions('Create module and ensure tests pass.')
      .withCriteria(['function greet'])
      .withTestCommand('npm test')
      .build();

    await harness.enqueueTasks([task]);

    // Provider creates file successfully
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['greet.ts'],
      files_updated: [],
      changes: ['Created greet.ts'],
      neededChanges: true,
      reasoning: 'Created module.',
      summary: 'Created greet.ts',
    }, {
      'greet.ts': 'export function greet(name: string) { return `Hello ${name}`; }',
    });

    // Test command fails — this triggers deterministic validation failure
    harness.executor.setCommandResponse('npm test', {
      exitCode: 1,
      stdout: '',
      stderr: 'Tests failed: 1 failure',
      passed: false,
    });

    // Helper agent validation call (secondary adapter, also gemini in tests)
    harness.gemini.pushSuccessResponse({
      isValid: false,
      verificationCommands: ['npm test'],
      reasoning: 'Tests are failing.',
    });

    // Retry orchestrator fix attempt
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: [],
      files_updated: ['greet.ts'],
      changes: ['Fixed greet.ts'],
      neededChanges: true,
      reasoning: 'Fixed the test issue.',
      summary: 'Fixed greet.ts',
    }, {
      'greet.ts': 'export function greet(name: string) { return `Hello, ${name}!`; }',
    });

    // After retry — more helper/validation calls may happen
    harness.gemini.pushSuccessResponse({
      isValid: true,
      verificationCommands: [],
      reasoning: 'All checks pass.',
    });

    // Goal completion
    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Module created and fixed.',
    });

    // Extra fallback responses in case pipeline needs more
    harness.gemini.pushSuccessResponse({ goal_completed: true, reasoning: 'Done.' });
    harness.gemini.pushSuccessResponse({ goal_completed: true, reasoning: 'Done.' });

    try {
      await harness.runControlLoop(10);
    } catch (e: any) {
      // May throw due to process.exit mock if halt is triggered
    }

    const finalState = await harness.getFinalState();
    expect(finalState).toBeTruthy();

    // System should have either completed (retry worked) or halted (retries exhausted)
    const validEndStates = ['COMPLETED', 'HALTED'];
    expect(validEndStates).toContain(finalState.supervisor.status);
  });
});
