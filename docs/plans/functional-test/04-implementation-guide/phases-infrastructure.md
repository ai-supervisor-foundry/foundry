# Implementation Guide

## Overview

This document provides step-by-step implementation guidance for the functional test suite, including module dependencies, integration patterns, common pitfalls, and best practices.

---

## 1. Implementation Phases

### Phase 1: Foundation

**Objective**: Build the infrastructure layer that all tests depend on.

**Components**:
1. Redis mock implementation
2. Test harness skeleton
3. Basic state and task builders
4. Jest configuration updates

**Order of Implementation**:

1. **Redis Mock** (`tests/mocks/infrastructure/redis/redis-mock.ts`)
   - Start with string operations (get, set, del, exists)
   - Add list operations (lpush, rpush, lpop, rpop, lrange, llen)
   - Implement database selection
   - Add call history tracking
   - Implement reset functionality
   - Test thoroughly with unit tests

2. **Redis Client Factory** (`tests/mocks/infrastructure/redis/redis-client-factory.ts`)
   - Create factory methods for different client types
   - Implement fixture loading
   - Add error simulation capabilities

3. **Redis Fixtures** (`tests/mocks/infrastructure/redis/redis-fixtures.ts`)
   - Define empty state
   - Create active workflow fixtures
   - Add completed workflow fixtures
   - Create mid-execution state fixtures

4. **State Builder** (`tests/helpers/state-builders.ts`)
   - Implement fluent API for state construction
   - Add preset methods (initial, running, halted, etc.)
   - Test builder outputs against schema

5. **Task Builder** (`tests/helpers/task-builders.ts`)
   - Implement fluent API for task construction
   - Add preset methods (simple, complex, ambiguous)
   - Test builder outputs against task schema

6. **Update Jest Config** (`jest.config.js`)
   - Add module path aliases
   - Configure setup files
   - Set coverage thresholds

7. **Create Setup File** (`tests/setup.ts`)
   - Initialize custom matchers
   - Set global test timeout
   - Configure test environment

**Validation**:
- [ ] Redis mock passes all unit tests
- [ ] Builders produce valid objects
- [ ] Jest runs with new configuration
- [ ] Module aliases resolve correctly

---

### Phase 2: Service Mocks

**Objective**: Implement all external service mocks.

**Components**:
1. Provider mocks (6 providers)
2. File system mock
3. Command executor mock
4. Adapter mocks

**Order of Implementation**:

1. **Base Provider Mock** (`tests/mocks/infrastructure/providers/base-provider.mock.ts`)
   - Define abstract base class
   - Implement response queue mechanism
   - Add call history tracking
   - Create helper methods

2. **Individual Provider Mocks** (implement in parallel or sequentially)
   - GeminiMock with all response types
   - CopilotMock with all response types
   - CursorMock with all response types
   - ClaudeMock with all response types
   - CodexMock with all response types
   - OllamaMock with all response types
   - Each mock includes success, error, and edge case responses

3. **File System Mock** (`tests/mocks/infrastructure/filesystem/fs.mock.ts`)
   - Implement in-memory file storage (Map<path, content>)
   - Add file operations (read, write, delete)
   - Implement directory operations (mkdir, rmdir, readdir)
   - Add glob pattern matching (use minimatch library)
   - Implement operation history tracking

4. **File Fixtures** (`tests/mocks/infrastructure/filesystem/file-fixtures.ts`)
   - Create TypeScript file templates
   - Add configuration file templates
   - Create incomplete/ambiguous file examples

5. **Sandbox Manager Mock** (`tests/mocks/infrastructure/filesystem/sandbox-manager.mock.ts`)
   - Build on top of FileSystemMock
   - Implement project-scoped operations
   - Add sandbox lifecycle management

6. **Command Executor Mock** (`tests/mocks/infrastructure/executor/command-executor.mock.ts`)
   - Implement command output mapping
   - Add execution history tracking
   - Create command matching logic (exact and pattern)

7. **Verification Commands** (`tests/mocks/infrastructure/executor/verification-commands.ts`)
   - Define common command outputs (tests, builds, linting)
   - Create command map helpers

8. **Circuit Breaker Mock** (`tests/mocks/adapters/circuit-breaker.mock.ts`)
   - Implement state management (OPEN, CLOSED, HALF_OPEN)
   - Add failure tracking
   - Implement timeout logic

9. **CLI Adapter Mock** (`tests/mocks/adapters/cli-adapter.mock.ts`)
   - Integrate provider mocks
   - Implement provider selection logic
   - Add circuit breaker integration

10. **Logger Mock** (`tests/mocks/adapters/logger.mock.ts`)
    - Capture all log entries
    - Implement filtering by level/component
    - Add silent mode for tests

**Validation**:
- [ ] All provider mocks return consistent responses
- [ ] File system operations work correctly
- [ ] Command executor produces expected outputs
- [ ] Mocks integrate with each other

---

### Phase 3: Test Harness

**Objective**: Build the comprehensive test environment orchestrator.

**Components**:
1. Test harness core
2. Scenario context
3. Execution trace
4. Helper utilities

**Order of Implementation**:

1. **Test Harness Core** (`tests/helpers/test-harness.ts`)
   - Implement constructor with dependency injection
   - Add lifecycle methods (setup, teardown, reset)
   - Implement configuration methods for each mock type
   - Add state management utilities
   - Implement task management utilities

2. **Execution Methods**
   - Implement runControlLoop (simulates full loop)
   - Add runSingleIteration (simulates one iteration)
   - Create step-by-step execution helpers

3. **Verification Methods**
   - Implement state assertions
   - Add task status checks
   - Create provider interaction verifications
   - Add queue state assertions

4. **Trace Capture**
   - Implement execution trace structure
   - Capture state changes
   - Record provider calls
   - Log validation reports

5. **Scenario Runner** (`tests/helpers/scenario-runner.ts`)
   - Build on top of TestHarness
   - Implement step-by-step scenario execution
   - Add common scenario patterns
   - Create assertion helpers

6. **Provider Simulator** (`tests/helpers/provider-simulator.ts`)
   - Create helper functions for common responses
   - Add file change generators
   - Implement error scenario helpers

**Validation**:
- [ ] Test harness integrates all mocks correctly
- [ ] Lifecycle methods work properly
- [ ] Execution trace captures all events
- [ ] Scenario runner executes multi-step flows

---

### Phase 4: Custom Matchers

**Objective**: Implement Foundry-specific Jest matchers.

**Components**:
1. State matchers
2. Task matchers
3. Validation matchers
4. Provider matchers

**Order of Implementation**:

1. **Matcher Implementations** (`tests/helpers/custom-matchers.ts`)
   - Implement toHaveSupervisorStatus
   - Add toHaveCompletedIteration
   - Create toBeInAutoMode / toBeInManualMode
   - Implement toHaveTaskStatus
   - Add toHaveCompletedTasks
   - Create toHaveExhaustedQueue
   - Implement provider matchers

2. **Matcher Registration** (`tests/helpers/assertion-helpers.ts`)
   - Create setupCustomMatchers function
   - Register all matchers with Jest
   - Add TypeScript declarations

3. **Update Setup File** (`tests/setup.ts`)
   - Call setupCustomMatchers in beforeAll

**Validation**:
- [ ] All matchers work correctly
- [ ] TypeScript autocomplete works
- [ ] Error messages are clear and helpful

---

### Phase 5: Scenario Implementation

**Objective**: Implement functional test scenarios using the infrastructure.

**Module Implementation Order**:

1. **Control Loop - Happy Path** (simplest, validates infrastructure)
2. **Control Loop - State Transitions** (core functionality)
3. **Task Lifecycle - Dispatch Execute Complete** (essential flow)
4. **Task Lifecycle - Validation Retry** (retry logic)
5. **Provider Management - Provider Fallback** (fallback logic)
6. **Provider Management - Circuit Breaker** (circuit breaker)
7. **Persistence - Crash Recovery** (recovery logic)
8. **Validation - Criteria Matching** (validation rules)
9. **Queue Operations - Queue Exhaustion** (queue handling)
10. **Execution Modes - AUTO Mode Flow** (mode handling)

**Per-Scenario Implementation Pattern**:

```typescript
// 1. Import dependencies
import { TestHarness } from '@helpers/test-harness';
import { StateBuilder, TaskBuilder } from '@helpers/builders';
import { Provider } from '@/domain/agents/enums/provider';

// 2. Set up test suite
describe('Module: Scenario Name', () => {
  let harness: TestHarness;

  // 3. Lifecycle hooks
  beforeEach(async () => {
    harness = new TestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  // 4. Individual test cases
  it('should handle specific scenario', async () => {
    // Setup: Configure mocks and initial state
    const initialState = StateBuilder.running()
      .withGoal('Test goal', 'test-project')
      .build();
    
    const task = TaskBuilder.simple('Test task')
      .withCriteria('File exists')
      .build();

    harness.loadState(initialState);
    harness.enqueueTasks([task]);
    
    // Configure provider mock
    harness.configureProvider(Provider.GEMINI, {
      response: GeminiMock.successResponse([
        { path: 'test.ts', type: 'create', content: 'test' }
      ])
    });

    // Execute: Run the scenario
    const result = await harness.runControlLoop(1);

    // Assert: Verify outcomes
    const finalState = await harness.getState();
    expect(finalState).toHaveSupervisorStatus('RUNNING');
    expect(finalState).toHaveCompletedTasks(1);
    expect(finalState).toHaveTaskStatus(task.task_id, 'completed');
    
    // Verify provider interaction
    harness.assertProviderCalled(Provider.GEMINI, 1);
  });
});
```

---

## 2. Integration Patterns

### Pattern 1: Mock Configuration

**Setup provider with specific behavior**:
```typescript
harness.configureProvider(Provider.GEMINI, {
  responses: [
    GeminiMock.successResponse([fileChange]),
    GeminiMock.quotaExceededResponse()
  ]
});
```

**Setup file system with files**:
```typescript
harness.configureFilesystem({
  'src/index.ts': 'export function main() {}',
  'package.json': '{ "name": "test" }'
});
```

**Setup command executor**:
```typescript
harness.configureExecutor(
  createCommandMap([
    { command: 'npm test', output: VerificationCommands.jestPass.output }
  ])
);
```

### Pattern 2: State Manipulation

**Load initial state**:
```typescript
const state = StateBuilder.running()
  .withIteration(5)
  .withCompletedTasks([task1, task2])
  .build();

await harness.loadState(state);
```

**Check state during execution**:
```typescript
const currentState = await harness.getState();
expect(currentState.supervisor.iteration).toBe(3);
```

### Pattern 3: Multi-Step Scenarios

**Using ScenarioRunner**:
```typescript
const runner = new ScenarioRunner(harness);

runner
  .loadInitialState(StateBuilder.running().build())
  .enqueueTasks([task1, task2, task3])
  .runIterations(3)
  .assertFinalState([
    { field: 'supervisor.status', value: 'COMPLETED' },
    { field: 'goal.completed', value: true }
  ]);

await runner.run();
```

### Pattern 4: Error Simulation

**Simulate provider failure**:
```typescript
harness.configureProvider(Provider.GEMINI, {
  responses: [
    GeminiMock.quotaExceededResponse()
  ]
});
```

**Simulate command failure**:
```typescript
harness.configureExecutor(
  createCommandMap([
    { command: 'npm test', output: VerificationCommands.jestFail.output }
  ])
);
```

