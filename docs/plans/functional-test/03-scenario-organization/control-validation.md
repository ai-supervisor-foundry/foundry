# Scenario Organization Plan

## Overview

This document details the functional test scenarios organized by module. Each module represents a major system capability with multiple test variants covering happy paths, edge cases, and failure scenarios.

---

## 1. Control Loop Scenarios

**Directory**: `tests/functional/scenarios/control-loop/`

### 1.1 Happy Path Complete Workflow

**File**: `happy-path.test.ts`

**Purpose**: Validate complete successful workflow from start to completion.

**Test Cases**:

#### Test: Simple workflow with 3 tasks
```typescript
Given: Initial state with goal "Build REST API"
And: Queue contains 3 pending tasks
When: Control loop runs
Then: All 3 tasks complete successfully
And: Goal marked as completed
And: Supervisor status is COMPLETED
And: Iteration count is 3
```

#### Test: Sequential task execution
```typescript
Given: Tasks with dependencies (task2 requires task1)
When: Control loop processes tasks
Then: Tasks execute in correct order
And: Each task starts only after previous completes
And: State persisted after each iteration
```

#### Test: Multiple iterations with different providers
```typescript
Given: Tasks assigned to different providers (GEMINI, COPILOT)
When: Control loop processes tasks
Then: Correct provider used for each task
And: Provider responses processed correctly
And: All tasks complete
```

### 1.2 State Transitions

**File**: `state-transitions.test.ts`

**Purpose**: Validate all supervisor state transitions.

**Test Cases**:

#### Test: IDLE → RUNNING transition
```typescript
Given: Supervisor in IDLE state
When: Goal set and tasks enqueued
And: Start command issued
Then: Status transitions to RUNNING
And: Iteration counter initialized to 0
```

#### Test: RUNNING → HALTED transition (queue exhausted)
```typescript
Given: Supervisor in RUNNING state
And: Queue has 1 remaining task
When: Last task completes
And: Queue is empty
And: Goal incomplete
Then: Status transitions to HALTED
And: Halt reason is TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE
```

#### Test: RUNNING → BLOCKED transition (ambiguity)
```typescript
Given: Supervisor in RUNNING state
When: Task produces ambiguous output
And: Validation detects ambiguity
Then: Status transitions to BLOCKED
And: Task marked as blocked
And: Halt reason is AMBIGUITY
```

#### Test: RUNNING → COMPLETED transition
```typescript
Given: Supervisor in RUNNING state
And: Queue has 1 remaining task
When: Last task completes
And: Goal validation passes
Then: Status transitions to COMPLETED
And: Goal marked as completed
```

#### Test: BLOCKED → RUNNING transition (manual unblock)
```typescript
Given: Supervisor in BLOCKED state
When: Operator unblocks task
And: Resume command issued
Then: Status transitions to RUNNING
And: Blocked task becomes pending
```

#### Test: HALTED → RUNNING transition (tasks added)
```typescript
Given: Supervisor in HALTED state (queue exhausted)
When: New tasks enqueued
And: Resume command issued
Then: Status transitions to RUNNING
And: Iteration continues
```

### 1.3 Iteration Tracking

**File**: `iteration-tracking.test.ts`

**Purpose**: Validate iteration counter management.

**Test Cases**:

#### Test: Iteration increments on each loop
```typescript
Given: Supervisor starting at iteration 0
When: Control loop processes 5 tasks
Then: Iteration counter increments to 5
And: Each state snapshot has correct iteration
```

#### Test: Iteration preserved across crash recovery
```typescript
Given: Supervisor at iteration 3
When: System crashes
And: State reloaded from Redis
Then: Iteration counter restored to 3
And: Next iteration is 4
```

#### Test: Iteration resets on goal completion
```typescript
Given: Supervisor completes goal at iteration 10
When: New goal set
And: Supervisor restarted
Then: Iteration counter resets to 0
```

---

## 2. Task Lifecycle Scenarios

**Directory**: `tests/functional/scenarios/task-lifecycle/`

### 2.1 Dispatch-Execute-Complete Flow

**File**: `dispatch-execute-complete.test.ts`

**Purpose**: Validate standard task processing flow.

**Test Cases**:

#### Test: Task dispatch to provider
```typescript
Given: Task in pending status
When: Control loop dequeues task
Then: Task status changes to in_progress
And: Provider dispatched with task context
And: State persisted with updated task status
```

#### Test: Successful task execution
```typescript
Given: Task dispatched to provider
When: Provider returns success with file changes
And: Validation passes
Then: Task status changes to completed
And: File changes applied
And: Task added to completed_tasks array
```

#### Test: Task with file creation
```typescript
Given: Task "Create user service"
When: Provider creates src/services/user.ts
And: Validation confirms file exists
Then: Task completes
And: File present in virtual filesystem
```

#### Test: Task with multiple file modifications
```typescript
Given: Task "Refactor authentication"
When: Provider modifies 3 files
And: Validation confirms all changes
Then: Task completes
And: All files updated correctly
```

### 2.2 Validation and Retry

**File**: `validation-retry.test.ts`

**Purpose**: Validate retry logic and validation failures.

**Test Cases**:

#### Test: Validation failure triggers retry
```typescript
Given: Task with acceptance criteria "Tests must pass"
When: Provider completes but tests fail
And: Validation reports failure
Then: Task remains in_progress
And: Retry count increments
And: Task re-dispatched with failure context
```

#### Test: Successful retry after validation failure
```typescript
Given: Task failed validation (retry_count = 1)
When: Provider re-executes with amended context
And: Validation passes
Then: Task status changes to completed
And: Retry count preserved in metadata
```

#### Test: Max retries exhausted
```typescript
Given: Task with max_retries = 2
When: Validation fails 3 times
Then: Task status changes to blocked
And: Task added to blocked_tasks array
And: Supervisor status changes to BLOCKED
```

#### Test: Ambiguous output detected
```typescript
Given: Task produces partial implementation
When: Validation detects TODO comments
Or: Incomplete function implementations
Then: Task marked as ambiguous
And: Retry with clarification context
```

### 2.3 Blocking Scenarios

**File**: `blocking-scenarios.test.ts`

**Purpose**: Validate task blocking conditions.

**Test Cases**:

#### Test: Task blocks on validation failure
```typescript
Given: Task exceeds max retries
When: Final retry fails validation
Then: Task status changes to blocked
And: Supervisor transitions to BLOCKED
And: Control loop halts
```

#### Test: Task blocks on provider error
```typescript
Given: Provider returns non-retryable error
When: Error type is INVALID_RESPONSE
Then: Task immediately blocked
And: No retry attempted
```

#### Test: Multiple blocked tasks accumulate
```typescript
Given: Supervisor processing tasks
When: Task1 blocks, unblocked manually
And: Task2 blocks later
Then: Both tasks in blocked_tasks array
And: Supervisor remains BLOCKED
```

#### Test: Manual unblock workflow
```typescript
Given: Task in blocked status
When: Operator marks task as pending
And: Resume command issued
Then: Task re-enters queue
And: Control loop processes task again
```

### 2.4 Task Metadata Preservation

**File**: `task-metadata-preservation.test.ts`

**Purpose**: Validate task metadata remains intact throughout lifecycle.

**Test Cases**:

#### Test: Metadata preserved through completion
```typescript
Given: Task with metadata { feature_id: 'auth-123' }
When: Task processed to completion
Then: Completed task retains all metadata
And: Metadata accessible in state
```

#### Test: Retry count tracked correctly
```typescript
Given: Task fails validation twice
When: Task finally completes on 3rd attempt
Then: Task metadata shows retry_count: 2
And: Retry history preserved
```

#### Test: Provider selection recorded
```typescript
Given: Task assigned to GEMINI
When: GEMINI circuit open, falls back to COPILOT
Then: Task metadata shows both attempts
And: Final provider recorded
```

---

## 3. Provider Management Scenarios

**Directory**: `tests/functional/scenarios/provider-management/`

### 3.1 Provider Fallback

**File**: `provider-fallback.test.ts`

**Purpose**: Validate provider fallback behavior.

**Test Cases**:

#### Test: Fallback on primary provider failure
```typescript
Given: Provider priority [GEMINI, COPILOT]
When: GEMINI returns quota error
Then: System falls back to COPILOT
And: Task dispatched to COPILOT
And: Task completes successfully
```

#### Test: Cascade through multiple providers
```typescript
Given: Provider priority [GEMINI, COPILOT, CURSOR]
When: GEMINI quota exceeded
And: COPILOT network error
Then: System tries CURSOR
And: Task completes with CURSOR
```

#### Test: All providers unavailable
```typescript
Given: All providers in priority list fail
When: Last provider attempted
Then: Task marked as blocked
And: Supervisor transitions to BLOCKED
```

### 3.2 Circuit Breaker

**File**: `circuit-breaker.test.ts`

**Purpose**: Validate circuit breaker functionality.

**Test Cases**:

#### Test: Circuit opens after threshold failures
```typescript
Given: GEMINI has 5 consecutive failures
When: Failure threshold reached
Then: Circuit opens for GEMINI
And: GEMINI skipped in provider selection
And: Next provider in priority used
```

#### Test: Circuit remains open during timeout
```typescript
Given: GEMINI circuit opened at T0
When: New task dispatched at T0 + 30s
And: Circuit timeout is 60s
Then: GEMINI still skipped
And: Fallback provider used
```

#### Test: Circuit half-open after timeout
```typescript
Given: GEMINI circuit opened at T0
When: T0 + 60s elapsed
Then: Circuit transitions to HALF_OPEN
And: Single test request allowed
```

#### Test: Circuit closes after successful test
```typescript
Given: GEMINI circuit in HALF_OPEN state
When: Test request succeeds
Then: Circuit closes
And: GEMINI available for all tasks
```

#### Test: Circuit reopens on test failure
```typescript
Given: GEMINI circuit in HALF_OPEN state
When: Test request fails
Then: Circuit reopens
And: Timeout period restarted
```

### 3.3 Quota Errors

**File**: `quota-errors.test.ts`

**Purpose**: Validate handling of quota/rate limit errors.

**Test Cases**:

#### Test: Quota exceeded handled gracefully
```typescript
Given: GEMINI quota exhausted
When: Task dispatched to GEMINI
Then: Quota error detected
And: Circuit opens for GEMINI
And: Fallback provider used immediately
```

#### Test: Quota error marked non-retryable
```typescript
Given: Provider returns quota error
When: Error analyzed
Then: Error classified as non-retryable
And: No retry attempted on same provider
And: Immediate fallback
```

### 3.4 Provider Priority

**File**: `provider-priority.test.ts`

**Purpose**: Validate provider selection based on priority.

**Test Cases**:

#### Test: Primary provider used when available
```typescript
Given: Provider priority [GEMINI, COPILOT]
When: Both providers available
And: Task dispatched
Then: GEMINI selected
```
