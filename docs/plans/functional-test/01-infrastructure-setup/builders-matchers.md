  .withStatus('pending')
  .build();
```

### 3.3 Assertion Helpers

**File**: `tests/helpers/assertion-helpers.ts`

**Purpose**: Custom Jest matchers for Foundry-specific assertions.

```typescript
declare global {
  namespace jest {
    interface Matchers<R> {
      // State matchers
      toHaveSupervisorStatus(status: SupervisorStatus): R;
      toHaveCompletedIteration(iteration: number): R;
      toBeInAutoMode(): R;
      toBeInManualMode(): R;
      toHaveHaltReason(reason: HaltReason): R;
      
      // Task matchers
      toHaveTaskStatus(taskId: string, status: TaskStatus): R;
      toHaveCompletedTasks(count: number): R;
      toHaveBlockedTasks(count: number): R;
      toHaveTask(taskId: string): R;
      
      // Goal matchers
      toHaveCompletedGoal(): R;
      toHaveIncompleteGoal(): R;
      
      // Queue matchers
      toHaveExhaustedQueue(): R;
      toHaveQueueLength(length: number): R;
      
      // Validation matchers
      toHavePassedValidation(): R;
      toHaveFailedValidation(): R;
      toHaveValidationConfidence(confidence: ConfidenceLevel): R;
      
      // Provider matchers
      toHaveUsedProvider(provider: Provider): R;
      toHaveCalledProvider(provider: Provider, times: number): R;
    }
  }
}

export function setupCustomMatchers(): void;
```

### 3.4 Provider Simulator

**File**: `tests/helpers/provider-simulator.ts`

**Purpose**: Simulate provider behavior patterns.

```typescript
export class ProviderSimulator {
  // Success scenarios
  static successWithFileChanges(files: FileChange[]): ProviderResponse;
  static successWithNoChanges(): ProviderResponse;
  
  // Failure scenarios
  static quotaExceeded(): ProviderResponse;
  static timeout(): ProviderResponse;
  static invalidResponse(): ProviderResponse;
  static networkError(): ProviderResponse;
  
  // Validation scenarios
  static ambiguousResponse(): ProviderResponse;
  static partialCompletion(): ProviderResponse;
  
  // Custom responses
  static custom(config: ResponseConfig): ProviderResponse;
}
```

### 3.5 Scenario Runner

**File**: `tests/helpers/scenario-runner.ts`

**Purpose**: Framework for executing multi-step scenarios.

```typescript
export class ScenarioRunner {
  private harness: TestHarness;
  private steps: ScenarioStep[];
  
  constructor(harness: TestHarness);
  
  // Step definition
  addStep(step: ScenarioStep): this;
  
  // Common step patterns
  loadInitialState(state: SupervisorState): this;
  enqueueTasks(tasks: Task[]): this;
  runIterations(count: number): this;
  assertFinalState(assertions: StateAssertion[]): this;
  
  // Execution
  async run(): Promise<ScenarioResult>;
  
  // Verification
  assertStepCompleted(stepIndex: number): void;
  assertNoErrors(): void;
}

export interface ScenarioStep {
  name: string;
  action: (harness: TestHarness) => Promise<void>;
  validation: (harness: TestHarness) => void;
}
```

---

## 4. Custom Jest Matchers

### 4.1 Implementation

**File**: `tests/helpers/custom-matchers.ts`

```typescript
import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';

// Example: toHaveSupervisorStatus
export function toHaveSupervisorStatus(
  received: SupervisorState,
  expected: SupervisorStatus
) {
  const pass = received.supervisor.status === expected;
  
  return {
    pass,
    message: () => {
      const hint = matcherHint('toHaveSupervisorStatus', 'state', 'status');
      const receivedValue = printReceived(received.supervisor.status);
      const expectedValue = printExpected(expected);
      
      return `${hint}\n\nExpected: ${expectedValue}\nReceived: ${receivedValue}`;
    }
  };
}

// Example: toHaveCompletedTasks
export function toHaveCompletedTasks(
  received: SupervisorState,
  expected: number
) {
  const actual = received.completed_tasks?.length || 0;
  const pass = actual === expected;
  
  return {
    pass,
    message: () => {
      const hint = matcherHint('toHaveCompletedTasks', 'state', 'count');
      return `${hint}\n\nExpected completed tasks: ${expected}\nReceived: ${actual}`;
    }
  };
}
```

### 4.2 Matcher Registration

**File**: `tests/setup.ts`

```typescript
import { setupCustomMatchers } from './helpers/assertion-helpers';

beforeAll(() => {
  setupCustomMatchers();
});
```

---

## 5. Jest Configuration Updates

### 5.1 Updated Configuration

**File**: `jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '^@helpers/(.*)$': '<rootDir>/tests/helpers/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/functional/fixtures/$1'
  },
  
  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/infrastructure/tooling/**',
    '!src/infrastructure/network/**',
  ],
  
  coverageThresholds: {
    global: {
      lines: 80,
      branches: 70,
      functions: 75,
      statements: 80
    }
  },
  
  // Performance
  maxWorkers: '50%',
  testTimeout: 10000,
  
  // Globals
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};
```

---

## 6. Implementation Checklist

### Redis Mock
- [ ] Implement RedisMock class with all required operations
- [ ] Add database switching support
- [ ] Implement call history tracking
- [ ] Add error simulation capabilities
- [ ] Create RedisClientFactory
- [ ] Build RedisFixtures library
- [ ] Write unit tests for RedisMock

### Test Harness
- [ ] Implement TestHarness class
- [ ] Add lifecycle methods (setup/teardown/reset)
- [ ] Implement configuration methods
- [ ] Add state management utilities
- [ ] Create execution methods
- [ ] Add verification helpers
- [ ] Implement execution tracing

### Builders
- [ ] Implement StateBuilder with fluent API
- [ ] Add preset methods for common states
- [ ] Implement TaskBuilder with fluent API
- [ ] Add preset methods for common tasks
- [ ] Write tests for builders

### Helpers
- [ ] Implement custom Jest matchers
- [ ] Create ProviderSimulator
- [ ] Build ScenarioRunner
- [ ] Add assertion helpers
- [ ] Write tests for helpers

### Configuration
- [ ] Update jest.config.js
- [ ] Create tests/setup.ts
- [ ] Add module path aliases
- [ ] Configure coverage thresholds

---

## 7. Validation

### Unit Tests for Infrastructure
- RedisMock operations work correctly
- TestHarness lifecycle functions properly
- Builders produce valid objects
- Custom matchers work as expected

### Integration Tests
- TestHarness integrates all mocks correctly
- ScenarioRunner executes multi-step flows
- Execution traces capture all events
- Assertions work with real test cases

---

**Document Version**: 1.0  
**Status**: Ready for Implementation
