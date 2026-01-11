```

#### Test: Priority order respected
```typescript
Given: Provider priority [GEMINI, COPILOT, CURSOR]
When: GEMINI unavailable
Then: COPILOT selected (not CURSOR)
```

#### Test: Custom priority per task
```typescript
Given: Task specifies tool: CURSOR
When: Task dispatched
Then: CURSOR used regardless of default priority
```

---

## 4. Persistence Scenarios

**Directory**: `tests/functional/scenarios/persistence/`

### 4.1 Crash Recovery

**File**: `crash-recovery.test.ts`

**Purpose**: Validate state recovery after crashes.

**Test Cases**:

#### Test: State recovered after abrupt termination
```typescript
Given: Supervisor at iteration 5 with 3 completed tasks
When: Process terminates unexpectedly
And: Supervisor restarted
And: State loaded from Redis
Then: Iteration counter restored to 5
And: Completed tasks array intact
And: Queue position preserved
```

#### Test: In-progress task handled correctly
```typescript
Given: Task1 in_progress when crash occurs
When: State reloaded
Then: Task1 status reset to pending
And: Task re-enqueued
And: Task retried from beginning
```

#### Test: Multiple crashes tolerated
```typescript
Given: Workflow with 10 tasks
When: Crashes occur at iterations 3, 6, 9
And: State recovered each time
Then: All 10 tasks eventually complete
And: Goal achieved
```

### 4.2 State Reload

**File**: `state-reload.test.ts`

**Purpose**: Validate state loading from Redis.

**Test Cases**:

#### Test: Complete state reconstructed
```typescript
Given: Complex state in Redis
When: State loaded on startup
Then: All fields correctly deserialized
And: Supervisor status correct
And: Goal intact
And: Task arrays populated
```

#### Test: Queue synchronized with state
```typescript
Given: State shows 5 completed tasks
And: Queue has 2 pending tasks
When: State loaded
Then: Queue operations reflect correct position
And: Next dequeue returns correct task
```

### 4.3 Incremental Persistence

**File**: `incremental-persistence.test.ts`

**Purpose**: Validate state persisted after each change.

**Test Cases**:

#### Test: State saved after each iteration
```typescript
Given: Control loop processing tasks
When: Iteration completes
Then: State immediately persisted to Redis
And: Redis contains updated state
```

#### Test: Task status changes persisted
```typescript
Given: Task transitions pending → in_progress → completed
When: Each transition occurs
Then: State persisted after each change
And: Redis reflects current status
```

### 4.4 Corruption Handling

**File**: `corruption-handling.test.ts`

**Purpose**: Validate handling of corrupted state.

**Test Cases**:

#### Test: Invalid JSON handled
```typescript
Given: Redis contains malformed JSON
When: State load attempted
Then: Error detected
And: Safe default state used
And: Operator notified
```

#### Test: Missing required fields handled
```typescript
Given: State missing supervisor.status field
When: State validated
Then: Validation fails
And: State reconstruction attempted
```

---

## 5. Validation Scenarios

**Directory**: `tests/functional/scenarios/validation/`

### 5.1 Ambiguity Detection

**File**: `ambiguity-detection.test.ts`

**Purpose**: Validate ambiguity detection in provider outputs.

**Test Cases**:

#### Test: TODO comments detected
```typescript
Given: Provider output contains "// TODO"
When: Validation runs
Then: Ambiguity detected
And: Confidence marked LOW
And: Task retried with clarification
```

#### Test: Incomplete implementations detected
```typescript
Given: Provider creates function with "throw new Error('Not implemented')"
When: Validation runs
Then: Ambiguity detected
And: Task marked for retry
```

#### Test: Vague commit messages detected
```typescript
Given: Provider commits with message "updated files"
When: Validation checks commit quality
Then: Ambiguity detected
```

### 5.2 Criteria Matching

**File**: `criteria-matching.test.ts`

**Purpose**: Validate acceptance criteria evaluation.

**Test Cases**:

#### Test: All criteria must pass
```typescript
Given: Task has 3 acceptance criteria
When: 2 criteria pass, 1 fails
Then: Validation fails
And: Task retried
```

#### Test: File existence criteria
```typescript
Given: Criteria "File src/user.ts must exist"
When: File created by provider
Then: Criteria passes
```

#### Test: Test pass criteria
```typescript
Given: Criteria "Tests must pass"
When: npm test executes successfully
Then: Criteria passes
```

#### Test: AST-based criteria
```typescript
Given: Criteria "Function validateUser must be exported"
When: AST analysis performed
Then: Export statement verified
And: Criteria passes
```

### 5.3 AST Validation

**File**: `ast-validation.test.ts`

**Purpose**: Validate AST-based deterministic validation.

**Test Cases**:

#### Test: Function signature validation
```typescript
Given: Criteria requires function with specific signature
When: AST parsed
And: Function signature extracted
Then: Signature matches requirements
And: Validation passes
```

#### Test: Class structure validation
```typescript
Given: Criteria requires class with specific methods
When: AST analyzed
Then: All required methods present
And: Method visibility correct
```

#### Test: Import statement validation
```typescript
Given: Criteria requires specific imports
When: AST parsed
Then: Import statements verified
And: Validation passes
```

### 5.4 Behavioral Validation

**File**: `behavioral-validation.test.ts`

**Purpose**: Validate behavioral acceptance criteria.

**Test Cases**:

#### Test: Test execution validation
```typescript
Given: Criteria "Unit tests pass"
When: Test runner executed
And: All tests pass
Then: Validation succeeds
```

#### Test: Compilation validation
```typescript
Given: Criteria "TypeScript compiles without errors"
When: tsc --noEmit executed
And: Exit code 0
Then: Validation succeeds
```

#### Test: Linting validation
```typescript
Given: Criteria "Code passes ESLint"
When: eslint executed
And: No errors reported
Then: Validation succeeds
```

---

## 6. Queue Operations Scenarios

**Directory**: `tests/functional/scenarios/queue-operations/`

### 6.1 Queue Exhaustion

**File**: `queue-exhaustion.test.ts`

**Purpose**: Validate queue exhaustion handling.

**Test Cases**:

#### Test: Halt on queue exhaustion with incomplete goal
```typescript
Given: Queue has 1 remaining task
When: Task completes
And: Goal incomplete
Then: Supervisor halts
And: Reason: TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE
```

#### Test: Complete on queue exhaustion with goal achieved
```typescript
Given: Queue has 1 remaining task
When: Task completes
And: Goal validation passes
Then: Supervisor status COMPLETED
```

### 6.2 Task Dequeue

**File**: `task-dequeue.test.ts`

**Purpose**: Validate task dequeuing behavior.

**Test Cases**:

#### Test: FIFO order maintained
```typescript
Given: Queue contains [task1, task2, task3]
When: Tasks dequeued
Then: Order is task1, task2, task3
```

#### Test: Empty queue handled
```typescript
Given: Queue is empty
When: Dequeue attempted
Then: Null returned
And: No error thrown
```

### 6.3 Queue Refill

**File**: `queue-refill.test.ts`

**Purpose**: Validate dynamic task enqueueing.

**Test Cases**:

#### Test: Tasks added during execution
```typescript
Given: Supervisor processing tasks
When: New tasks enqueued mid-execution
Then: New tasks added to queue
And: Processing continues seamlessly
```

### 6.4 Queue Persistence

**File**: `queue-persistence.test.ts`

**Purpose**: Validate queue state persistence.

**Test Cases**:

#### Test: Queue state persisted in Redis
```typescript
Given: Queue contains 5 tasks
When: State persisted
Then: Redis list contains all 5 tasks
And: Order preserved
```

#### Test: Queue restored after crash
```typescript
Given: Queue had 3 tasks when crashed
When: System restarted
Then: Queue reloaded with 3 tasks
And: Order maintained
```

---

## 7. Execution Modes Scenarios

**Directory**: `tests/functional/scenarios/execution-modes/`

### 7.1 AUTO Mode Flow

**File**: `auto-mode-flow.test.ts`

**Purpose**: Validate autonomous execution in AUTO mode.

**Test Cases**:

#### Test: AUTO mode continuous execution
```typescript
Given: Supervisor in AUTO mode
When: Tasks enqueued
Then: Supervisor processes all tasks automatically
And: No manual intervention required
```

#### Test: AUTO mode respects halt conditions
```typescript
Given: Supervisor in AUTO mode
When: Blocking condition encountered
Then: Supervisor halts automatically
And: Awaits manual intervention
```

### 7.2 Manual Intervention

**File**: `manual-intervention.test.ts`

**Purpose**: Validate manual mode operations.

**Test Cases**:

#### Test: MANUAL mode requires explicit continuation
```typescript
Given: Supervisor in MANUAL mode
When: Task completes
Then: Supervisor waits for continue command
And: Next task not started automatically
```

#### Test: Task approval in MANUAL mode
```typescript
Given: Supervisor in MANUAL mode
When: Task requires approval
Then: Task waits for operator review
And: Proceeds only after approval
```

### 7.3 Mode Transitions

**File**: `mode-transitions.test.ts`

**Purpose**: Validate execution mode switching.

**Test Cases**:

#### Test: AUTO → MANUAL transition
```typescript
Given: Supervisor in AUTO mode
When: Switch to MANUAL command issued
Then: Current task completes
And: Mode changes to MANUAL
And: Next task awaits manual start
```

#### Test: MANUAL → AUTO transition
```typescript
Given: Supervisor in MANUAL mode
When: Switch to AUTO command issued
Then: Mode changes to AUTO
And: Automatic processing resumes
```

### 7.4 Halt and Resume

**File**: `halt-resume.test.ts`

**Purpose**: Validate halt and resume operations.

**Test Cases**:

#### Test: Halt stops execution gracefully
```typescript
Given: Supervisor processing tasks
When: Halt command issued
Then: Current task completes
And: Supervisor status HALTED
And: No further tasks processed
```

#### Test: Resume continues from halt point
```typescript
Given: Supervisor halted at iteration 5
When: Resume command issued
Then: Processing continues from iteration 5
And: Next task in queue processed
```

---

## Implementation Priority

1. **Control Loop** (happy-path, state-transitions)
2. **Task Lifecycle** (dispatch-execute-complete, validation-retry)
3. **Provider Management** (provider-fallback, circuit-breaker)
4. **Persistence** (crash-recovery, state-reload)
5. **Validation** (ambiguity-detection, criteria-matching)
6. **Queue Operations** (queue-exhaustion, task-dequeue)
7. **Execution Modes** (auto-mode-flow, halt-resume)

---

**Document Version**: 1.0  
**Status**: Ready for Implementation
