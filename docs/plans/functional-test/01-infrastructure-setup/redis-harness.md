# Infrastructure Setup Plan

## Overview

This document details the infrastructure layer required for functional testing: Redis mocking, test harness, helper utilities, and custom Jest matchers. This foundation supports all functional tests with deterministic, isolated, and fast execution.

---

## 1. Redis Mock Implementation

### 1.1 Requirements

**Purpose**: Provide in-memory Redis compatible with ioredis API for state and queue operations.

**Key Features**:
- Full ioredis API compatibility for operations used in Foundry
- In-memory data storage (no persistence)
- Support for multiple databases (db 0, 1, 2)
- Connection lifecycle simulation
- Error simulation capabilities
- Call tracking for verification

### 1.2 Redis Mock Structure

**File**: `tests/mocks/infrastructure/redis/redis-mock.ts`

**Core Operations to Mock**:
```typescript
// String operations
- get(key: string): Promise<string | null>
- set(key: string, value: string): Promise<'OK'>
- del(key: string): Promise<number>
- exists(key: string): Promise<number>

// List operations (for queue)
- lpush(key: string, ...values: string[]): Promise<number>
- rpush(key: string, ...values: string[]): Promise<number>
- lpop(key: string): Promise<string | null>
- rpop(key: string): Promise<string | null>
- llen(key: string): Promise<number>
- lrange(key: string, start: number, stop: number): Promise<string[]>
- lindex(key: string, index: number): Promise<string | null>

// Database operations
- select(db: number): Promise<'OK'>
- flushdb(): Promise<'OK'>
- flushall(): Promise<'OK'>

// Connection operations
- connect(): Promise<void>
- disconnect(): Promise<void>
- quit(): Promise<'OK'>

// Pub/Sub (if needed)
- publish(channel: string, message: string): Promise<number>
- subscribe(channel: string): void
```

**Implementation Details**:
```typescript
interface RedisDatabase {
  strings: Map<string, string>;
  lists: Map<string, string[]>;
}

class RedisMock {
  private databases: Map<number, RedisDatabase> = new Map();
  private currentDb: number = 0;
  private connected: boolean = false;
  private callHistory: MethodCall[] = [];
  private errorSimulation: ErrorConfig | null = null;

  // Track all method calls for verification
  private recordCall(method: string, args: any[]): void;
  
  // Simulate network errors
  setErrorSimulation(config: ErrorConfig): void;
  
  // Get call history for assertions
  getCallHistory(): MethodCall[];
  
  // Reset state between tests
  reset(): void;
}
```

### 1.3 Redis Client Factory

**File**: `tests/mocks/infrastructure/redis/redis-client-factory.ts`

**Purpose**: Create configured Redis mock instances for different use cases.

```typescript
export class RedisClientFactory {
  static createStateClient(options?: StateClientOptions): RedisMock;
  static createQueueClient(options?: QueueClientOptions): RedisMock;
  static createCircuitBreakerClient(options?: CircuitBreakerOptions): RedisMock;
  
  // Create client with pre-populated data
  static createWithFixture(fixture: RedisFixture): RedisMock;
  
  // Create client that simulates specific error scenarios
  static createWithError(errorType: RedisErrorType): RedisMock;
}
```

### 1.4 Redis Fixtures

**File**: `tests/mocks/infrastructure/redis/redis-fixtures.ts`

**Purpose**: Predefined Redis states for common test scenarios.

```typescript
export const RedisFixtures = {
  // Empty state
  empty: {
    db0: {},
    db1: {},
    db2: {}
  },
  
  // State with active goal and pending tasks
  activeWorkflow: {
    db0: {
      'supervisor:state': JSON.stringify({ /* state */ })
    },
    db2: {
      'tasks': ['task1', 'task2', 'task3']
    }
  },
  
  // State with completed workflow
  completedWorkflow: {
    db0: {
      'supervisor:state': JSON.stringify({ 
        supervisor: { status: 'COMPLETED' },
        goal: { completed: true }
      })
    },
    db2: {
      'tasks': []
    }
  },
  
  // State mid-execution
  midExecution: {
    db0: {
      'supervisor:state': JSON.stringify({
        supervisor: { status: 'RUNNING', iteration: 5 },
        completed_tasks: ['task1', 'task2']
      })
    },
    db2: {
      'tasks': ['task3', 'task4']
    }
  },
  
  // Circuit breaker states
  circuitBreakerOpen: {
    db1: {
      'circuit:GEMINI': JSON.stringify({ state: 'OPEN', failures: 5 })
    }
  }
};
```

---

## 2. Test Harness Architecture

### 2.1 Test Harness Overview

**File**: `tests/helpers/test-harness.ts`

**Purpose**: Provide complete test environment setup and teardown with all mocks configured.

**Core Responsibilities**:
- Initialize all required mocks
- Configure mock behavior for scenario
- Provide clean state for each test
- Capture execution traces
- Facilitate assertions

### 2.2 Test Harness Structure

```typescript
export class TestHarness {
  // Mock instances
  private redisClient: RedisMock;
  private providerMocks: Map<Provider, ProviderMock>;
  private filesystemMock: FileSystemMock;
  private executorMock: CommandExecutorMock;
  
  // Test context
  private scenarioContext: ScenarioContext;
  private executionTrace: ExecutionTrace;
  
  constructor(options?: HarnessOptions);
  
  // Lifecycle
  async setup(): Promise<void>;
  async teardown(): Promise<void>;
  async reset(): Promise<void>;
  
  // Configuration
  configureRedis(fixture: RedisFixture): void;
  configureProvider(provider: Provider, behavior: ProviderBehavior): void;
  configureFilesystem(files: VirtualFileSystem): void;
  configureExecutor(commandMap: CommandOutputMap): void;
  
  // State management
  loadState(state: SupervisorState): Promise<void>;
  getState(): Promise<SupervisorState>;
  
  // Task management
  enqueueTasks(tasks: Task[]): Promise<void>;
  dequeueTasks(): Promise<Task[]>;
  
  // Execution
  runControlLoop(iterations?: number): Promise<ExecutionResult>;
  runSingleIteration(): Promise<IterationResult>;
  
  // Verification
  assertState(expected: Partial<SupervisorState>): void;
  assertTaskStatus(taskId: string, status: TaskStatus): void;
  assertProviderCalled(provider: Provider, times?: number): void;
  
  // Trace access
  getExecutionTrace(): ExecutionTrace;
  getProviderInteractions(): ProviderInteraction[];
}
```

### 2.3 Scenario Context

```typescript
export interface ScenarioContext {
  name: string;
  description: string;
  initialState: SupervisorState;
  tasks: Task[];
  expectedOutcome: ExpectedOutcome;
  mockBehaviors: MockBehaviors;
}

export interface MockBehaviors {
  providers: Map<Provider, ProviderBehavior>;
  redis: RedisFixture;
  filesystem: VirtualFileSystem;
  executor: CommandOutputMap;
}

export interface ExpectedOutcome {
  finalSupervisorStatus: SupervisorStatus;
  completedTaskCount: number;
  blockedTaskCount: number;
  goalCompleted: boolean;
  haltReason?: HaltReason;
}
```

### 2.4 Execution Trace

```typescript
export interface ExecutionTrace {
  iterations: IterationTrace[];
  stateChanges: StateChange[];
  providerCalls: ProviderCall[];
  validationReports: ValidationReport[];
  errors: Error[];
}

export interface IterationTrace {
  iteration: number;
  timestamp: string;
  taskId: string | null;
  action: string;
  result: string;
  duration: number;
}
```

---

## 3. Helper Utilities

### 3.1 State Builders

**File**: `tests/helpers/state-builders.ts`

**Purpose**: Fluent API for constructing supervisor states.

```typescript
export class StateBuilder {
  private state: SupervisorState;
  
  constructor();
  
  // Supervisor configuration
  withStatus(status: SupervisorStatus): this;
  withIteration(iteration: number): this;
  withLastTaskId(taskId: string): this;
  withHaltReason(reason: HaltReason): this;
  
  // Goal configuration
  withGoal(description: string, projectId: string): this;
  withCompletedGoal(): this;
  
  // Queue configuration
  withExhaustedQueue(): this;
  withActiveQueue(): this;
  
  // Task collections
  withCompletedTasks(tasks: Task[]): this;
  withBlockedTasks(tasks: Task[]): this;
  
  // Execution mode
  inAutoMode(): this;
  inManualMode(): this;
  
  // Metadata
  withTimestamp(timestamp: string): this;
  withProvider(provider: Provider): this;
  
  // Build
  build(): SupervisorState;
  
  // Presets
  static initial(): StateBuilder;
  static running(): StateBuilder;
  static halted(reason: HaltReason): StateBuilder;
  static blocked(): StateBuilder;
  static completed(): StateBuilder;
}

// Usage example:
const state = StateBuilder.running()
  .withIteration(5)
  .withGoal('Build REST API', 'my-project')
  .withCompletedTasks([task1, task2])
  .inAutoMode()
  .build();
```

### 3.2 Task Builders

**File**: `tests/helpers/task-builders.ts`

**Purpose**: Fluent API for constructing tasks.

```typescript
export class TaskBuilder {
  private task: Task;
  
  constructor();
  
  // Basic configuration
  withId(id: string): this;
  withIntent(intent: string): this;
  withInstructions(instructions: string): this;
  
  // Task type and tool
  asCodeTask(): this;
  asBehavioralTask(): this;
  withTool(tool: Provider): this;
  
  // Acceptance criteria
  withCriteria(...criteria: string[]): this;
  withFileExistsCriteria(filePath: string): this;
  withTestPassCriteria(testName: string): this;
  
  // Status and metadata
  withStatus(status: TaskStatus): this;
  withRetryPolicy(maxRetries: number): this;
  withRetryCount(count: number): this;
  withMetadata(meta: Record<string, any>): this;
  
  // Context
  withContext(context: TaskContext): this;
  
  // Build
  build(): Task;
  
  // Presets
  static simple(intent: string): TaskBuilder;
  static withValidation(intent: string, criteria: string[]): TaskBuilder;
  static complex(): TaskBuilder;
  static ambiguous(): TaskBuilder;
}

// Usage example:
const task = TaskBuilder.simple('Implement user login')
  .withId('task-001')
  .withTool(Provider.COPILOT)
  .withCriteria(
    'File src/auth/login.ts exists',
    'Function validateCredentials implemented',
    'Tests pass'
  )
  .withStatus('pending')
