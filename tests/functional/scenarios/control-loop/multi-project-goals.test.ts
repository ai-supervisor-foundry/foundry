import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';

describe('Functional: Control Loop - Multi-Project Goals', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('should track goals per project and complete when all goals are met', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Build auth module', 'auth-service')
      .withGoal('Build user module', 'user-service')
      .build();

    await harness.loadInitialState(initialState);

    const authTask = TaskBuilder.coding('task-auth-1', 'Create auth handler')
      .withProjectId('auth-service')
      .withInstructions('Create auth.ts with login and logout.')
      .withCriteria(['function login', 'function logout'])
      .build();

    const userTask = TaskBuilder.coding('task-user-1', 'Create user model')
      .withProjectId('user-service')
      .withInstructions('Create user.ts with UserModel class.')
      .withCriteria(['class UserModel'])
      .build();

    await harness.enqueueTasks([authTask, userTask]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['auth.ts'],
      files_updated: [],
      changes: ['Created auth.ts'],
      neededChanges: true,
      reasoning: 'Created auth handler.',
      summary: 'Created auth.ts with login/logout',
    }, {
      'auth.ts': 'export function login() { return true; }\nexport function logout() { return true; }',
    });

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['user.ts'],
      files_updated: [],
      changes: ['Created user.ts'],
      neededChanges: true,
      reasoning: 'Created user model.',
      summary: 'Created user.ts with UserModel class',
    }, {
      'user.ts': 'export class UserModel { id: string = ""; name: string = ""; }',
    });

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'Both auth and user modules created.',
    });

    await harness.runControlLoop(15);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks).toHaveLength(2);
    expect(finalState.goals['auth-service']).toBeDefined();
    expect(finalState.goals['user-service']).toBeDefined();
    expect(finalState.goals['auth-service'].completed).toBe(true);
    expect(finalState.goals['user-service'].completed).toBe(true);
  });

  it('should handle goals with different project IDs in task routing', async () => {
    const initialState = StateBuilder.running()
      .withGoal('Setup API', 'api-project')
      .build();

    await harness.loadInitialState(initialState);

    const task = TaskBuilder.coding('task-api-1', 'Create API endpoint')
      .withProjectId('api-project')
      .withInstructions('Create routes.ts with health endpoint.')
      .withCriteria(['function healthCheck'])
      .build();

    await harness.enqueueTasks([task]);

    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['routes.ts'],
      files_updated: [],
      changes: ['Created routes.ts'],
      neededChanges: true,
      reasoning: 'Created routes.',
      summary: 'Created routes.ts',
    }, {
      'routes.ts': 'export function healthCheck() { return { status: "ok" }; }',
    });

    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'API setup complete.',
    });

    await harness.runControlLoop(10);

    const finalState = await harness.getFinalState();

    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.completed_tasks[0].task_id).toBe('task-api-1');
    expect(finalState.goals['api-project'].completed).toBe(true);
  });
});
