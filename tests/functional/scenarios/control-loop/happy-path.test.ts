import { TestHarness } from '@helpers/test-harness';
import { StateBuilder } from '@helpers/state-builders';
import { TaskBuilder } from '@helpers/task-builders';
import { Provider } from '@/domain/agents/enums/provider';

describe('Functional: Control Loop - Happy Path', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  it('should complete a single task and finish the goal', async () => {
    // 1. Setup Initial State
    const initialState = StateBuilder.running()
      .withGoal('Implement a greeting function', 'test-project')
      .build();
    
    await harness.loadInitialState(initialState);

    // 2. Enqueue Task
    const task = TaskBuilder.coding('task-001', 'Add greeting function')
      .withInstructions('Create a file named greeting.ts that exports a greet function.')
      .withCriteria(['function greet exists'])
      .build();
    
    await harness.enqueueTasks([task]);

    // 3. Configure Provider Mock for Task Execution
    harness.gemini.pushSuccessResponse({
      status: 'completed',
      files_created: ['greeting.ts'],
      files_updated: [],
      changes: ['Created greeting.ts'],
      neededChanges: true,
      reasoning: 'Task requested a greeting function, so I created greeting.ts.',
      summary: 'Created greeting function in greeting.ts'
    }, {
      'greeting.ts': 'export function greet() { return "Hello World"; }'
    });

    // 4. Configure Provider Mock for Goal Completion Check
    // This is called when the queue is empty
    harness.gemini.pushSuccessResponse({
      goal_completed: true,
      reasoning: 'The single task was completed successfully.'
    });

    // 5. Execute Control Loop
    await harness.runControlLoop();

    // 6. Assert Final State
    const finalState = await harness.getFinalState();
    
    expect(finalState.supervisor.status).toBe('COMPLETED');
    expect(finalState.goal.completed).toBe(true);
    expect(finalState.completed_tasks).toHaveLength(1);
    expect(finalState.completed_tasks[0].task_id).toBe('task-001');
    expect(finalState.queue.exhausted).toBe(true);
  });
});
