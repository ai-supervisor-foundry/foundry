
---

## 3. Common Pitfalls

### Pitfall 1: Forgotten Reset
**Problem**: State bleeds between tests
**Solution**: Always call `await harness.teardown()` in afterEach

### Pitfall 2: Async Issues
**Problem**: Tests complete before async operations finish
**Solution**: Always await harness methods and use async/await properly

### Pitfall 3: Mock Configuration Order
**Problem**: Mocks configured after execution starts
**Solution**: Configure all mocks before calling runControlLoop

### Pitfall 4: State Mutation
**Problem**: Directly mutating state objects affects other tests
**Solution**: Always use builders to create fresh state objects

### Pitfall 5: Provider Response Queue Empty
**Problem**: More iterations than queued responses
**Solution**: Queue enough responses or set default behavior

### Pitfall 6: Hardcoded Timestamps
**Problem**: Timestamp comparisons fail
**Solution**: Use fixed timestamps from test helpers

### Pitfall 7: Over-Mocking
**Problem**: Mocking internal implementation details
**Solution**: Mock only external services, test behavior not implementation

### Pitfall 8: Unclear Assertions
**Problem**: Test failures don't explain what went wrong
**Solution**: Use custom matchers with clear error messages

---

## 4. Testing Best Practices

### Practice 1: Arrange-Act-Assert
Structure tests clearly:
```typescript
it('should complete task successfully', async () => {
  // Arrange: Setup
  const state = StateBuilder.running().build();
  const task = TaskBuilder.simple('Test').build();
  harness.loadState(state);
  harness.enqueueTasks([task]);

  // Act: Execute
  await harness.runControlLoop(1);

  // Assert: Verify
  const finalState = await harness.getState();
  expect(finalState).toHaveCompletedTasks(1);
});
```

### Practice 2: One Logical Assertion Per Test
Each test should verify one scenario:
```typescript
// Good
it('should transition to COMPLETED when goal achieved', async () => {
  // ... test code
  expect(finalState).toHaveSupervisorStatus('COMPLETED');
});

it('should mark goal as completed', async () => {
  // ... test code
  expect(finalState.goal.completed).toBe(true);
});

// Avoid
it('should complete workflow', async () => {
  expect(finalState).toHaveSupervisorStatus('COMPLETED');
  expect(finalState.goal.completed).toBe(true);
  expect(finalState.queue.exhausted).toBe(true);
  // Too many concerns
});
```

### Practice 3: Descriptive Test Names
```typescript
// Good
it('should transition from RUNNING to BLOCKED when ambiguity detected', () => {});

// Avoid
it('should work', () => {});
it('test state change', () => {});
```

### Practice 4: Use Helpers and Fixtures
```typescript
// Good
const task = TaskBuilder.simple('Create user service')
  .withCriteria('File exists', 'Tests pass')
  .build();

// Avoid
const task = {
  task_id: 'task-001',
  intent: 'Create user service',
  tool: 'CURSOR',
  // ... 20 more fields
};
```

### Practice 5: Test Edge Cases
Don't just test happy path:
- Empty queues
- Null values
- Max retry limits
- All providers failing
- Corrupted state

### Practice 6: Verify Mock Interactions
```typescript
// Verify provider was called
harness.assertProviderCalled(Provider.GEMINI, 1);

// Verify file was written
expect(harness.filesystemMock.wasFileCalled('src/index.ts', 'write')).toBe(true);

// Verify command executed
expect(harness.executorMock.wasCommandExecuted('npm test')).toBe(true);
```

---

## 5. Debugging Failed Tests

### Step 1: Check Execution Trace
```typescript
const trace = harness.getExecutionTrace();
console.log(JSON.stringify(trace, null, 2));
```

### Step 2: Inspect State at Failure Point
```typescript
const state = await harness.getState();
console.log('State at failure:', state);
```

### Step 3: Review Mock Call History
```typescript
const providerCalls = harness.getProviderInteractions();
console.log('Provider calls:', providerCalls);
```

### Step 4: Check Logs
```typescript
const logs = harness.loggerMock.getLogs();
console.log('Execution logs:', logs);
```

### Step 5: Isolate the Issue
Create a minimal test case that reproduces the failure

---

## 6. Performance Optimization

### Optimization 1: Parallel Test Execution
Jest runs test files in parallel by default:
```javascript
// jest.config.js
maxWorkers: '50%'
```

### Optimization 2: Reduce Mock Overhead
Only configure mocks you need:
```typescript
// Instead of configuring all 6 providers:
harness.configureProvider(Provider.GEMINI, behavior);
harness.configureProvider(Provider.COPILOT, behavior);
// ... etc

// Only configure what you'll use:
harness.configureProvider(Provider.GEMINI, behavior);
```

### Optimization 3: Reuse Fixtures
Load fixtures once, reuse across tests:
```typescript
const standardTask = TaskBuilder.simple('Test').build();

it('test 1', () => { /* use standardTask */ });
it('test 2', () => { /* use standardTask */ });
```

### Optimization 4: Limit Execution Trace
Only enable detailed tracing when debugging:
```typescript
const harness = new TestHarness({ 
  enableTrace: process.env.DEBUG === 'true' 
});
```

---

## 7. CI/CD Integration

### GitHub Actions Example
```yaml
name: Functional Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:functional
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

### Test Scripts (package.json)
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:functional": "jest tests/functional",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## 8. Documentation

### Document Each Scenario
Include in test file:
```typescript
/**
 * Scenario: Provider Fallback on Primary Failure
 * 
 * Purpose: Validates that when the primary provider fails with a quota error,
 * the system gracefully falls back to the next provider in the priority list.
 * 
 * Setup:
 * - Provider priority: [GEMINI, COPILOT]
 * - GEMINI configured to return quota exceeded error
 * - COPILOT configured to succeed
 * 
 * Expected Outcome:
 * - Task dispatched to GEMINI first
 * - GEMINI fails with quota error
 * - System falls back to COPILOT
 * - Task completes successfully via COPILOT
 */
describe('Provider Fallback', () => {
  // ... tests
});
```

### Maintain Test README
Create `tests/functional/README.md`:
- Overview of functional tests
- How to run tests
- How to add new scenarios
- Debugging tips

---

## 9. Maintenance

### Adding New Scenarios
1. Identify the module (control-loop, task-lifecycle, etc.)
2. Create test file in appropriate directory
3. Follow implementation pattern
4. Add documentation
5. Update this guide if new patterns emerge

### Updating Mocks
When Foundry code changes:
1. Update mock implementations to match new interfaces
2. Add new response types if needed
3. Update fixtures
4. Run full test suite to catch regressions

### Refactoring Tests
- Keep DRY principle: extract common setup to helpers
- Maintain clear test names
- Update documentation
- Ensure all tests still pass

---

**Document Version**: 1.0  
**Status**: Ready for Implementation
