# Task Dependencies and Parallel Execution Implementation Plan

## Overview

This plan implements a comprehensive task dependency system with parallel execution support. The supervisor will:
- Support hard and soft task dependencies
- Maintain separate ready and waiting queues
- Execute up to 3 tasks concurrently
- Track a full dependency graph in state
- Validate dependencies at both enqueue and runtime
- Detect circular dependencies at both stages

## Architecture Changes

### Current Architecture
```
Single FIFO Queue → Sequential Processing → One Task at a Time
```

### New Architecture
```
Dual Queue System:
  - Ready Queue (tasks with met dependencies)
  - Waiting Queue (tasks with unmet dependencies)
  
Parallel Execution:
  - Up to 3 concurrent tasks
  - Dependency graph tracking
  - Automatic queue promotion (waiting → ready)
```

## Data Structure Changes

### 1. Task Interface Enhancement

**File**: `src/types.ts`

Add dependency fields to `Task` interface:

```typescript
export interface Task {
  // ... existing fields ...
  
  // Dependency fields
  depends_on?: TaskDependency[]; // Array of dependencies
}

export interface TaskDependency {
  task_id: string; // Required task_id
  type: 'hard' | 'soft'; // Hard = must complete, Soft = preferred but not required
}
```

### 2. State Schema Enhancement

**File**: `src/types.ts`

Add dependency tracking to `SupervisorState`:

```typescript
export interface SupervisorState {
  // ... existing fields ...
  
  // Dependency graph tracking
  dependency_graph?: DependencyGraph;
  
  // In-flight tasks (currently being processed in parallel)
  in_flight_tasks?: InFlightTask[];
  
  // Enhanced queue state
  queue: {
    exhausted: boolean;
    ready_count?: number; // Tasks in ready queue
    waiting_count?: number; // Tasks in waiting queue
  };
}

export interface DependencyGraph {
  nodes: DependencyNode[]; // All tasks in the system
  edges: DependencyEdge[]; // Dependency relationships
  last_updated: string; // ISO timestamp
}

export interface DependencyNode {
  task_id: string;
  status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  queue_location: 'ready' | 'waiting'; // Which queue the task is in
  hard_dependencies: string[]; // task_ids of hard dependencies
  soft_dependencies: string[]; // task_ids of soft dependencies
  dependents: string[]; // task_ids that depend on this task
}

export interface DependencyEdge {
  from: string; // task_id of dependency
  to: string; // task_id of dependent task
  type: 'hard' | 'soft';
}

export interface InFlightTask {
  task_id: string;
  started_at: string; // ISO timestamp
  iteration: number; // Control loop iteration when started
  promise_id?: string; // Internal tracking ID
}
```

## Queue System Changes

### 1. Dual Queue Implementation

**File**: `src/queue.ts`

Replace single queue with dual queue system:

```typescript
// Queue keys
export function getReadyQueueKey(queueName: string): string {
  return `queue:${queueName}:ready`;
}

export function getWaitingQueueKey(queueName: string): string {
  return `queue:${queueName}:waiting`;
}

// Enqueue to appropriate queue based on dependencies
export async function enqueueTaskWithDependencies(
  client: Redis,
  readyQueueKey: string,
  waitingQueueKey: string,
  task: Task,
  completedTaskIds: string[] // Already completed tasks
): Promise<'ready' | 'waiting'> {
  // Check if all hard dependencies are met
  const allHardDepsMet = checkHardDependencies(task, completedTaskIds);
  
  if (allHardDepsMet) {
    await client.lpush(readyQueueKey, JSON.stringify(task));
    return 'ready';
  } else {
    await client.lpush(waitingQueueKey, JSON.stringify(task));
    return 'waiting';
  }
}

// Move tasks from waiting to ready when dependencies complete
export async function promoteWaitingTasks(
  client: Redis,
  readyQueueKey: string,
  waitingQueueKey: string,
  completedTaskId: string,
  dependencyGraph: DependencyGraph
): Promise<string[]> {
  // Find all waiting tasks that depend on completedTaskId
  // Check if their dependencies are now met
  // Move to ready queue
  // Return list of promoted task_ids
}

// Dequeue from ready queue (supports multiple for parallel execution)
export async function dequeueReadyTasks(
  client: Redis,
  readyQueueKey: string,
  maxCount: number = 1
): Promise<Task[]> {
  // Dequeue up to maxCount tasks atomically
  // Returns array of tasks (may be less than maxCount if queue is smaller)
}
```

### 2. Dependency Validation Functions

**File**: `src/dependencyValidator.ts` (NEW)

```typescript
// Validate dependencies exist in task list
export function validateDependenciesExist(
  task: Task,
  allTaskIds: string[]
): { valid: boolean; missing: string[] }

// Detect circular dependencies using DFS
export function detectCircularDependencies(
  tasks: Task[]
): { hasCycle: boolean; cycle?: string[] }

// Check if all hard dependencies are met
export function checkHardDependencies(
  task: Task,
  completedTaskIds: string[]
): boolean

// Check if all dependencies (hard + soft) are met
export function checkAllDependencies(
  task: Task,
  completedTaskIds: string[]
): { allMet: boolean; unmetHard: string[]; unmetSoft: string[] }

// Build dependency graph from task list
export function buildDependencyGraph(
  tasks: Task[]
): DependencyGraph

// Update dependency graph when task completes
export function updateDependencyGraph(
  graph: DependencyGraph,
  completedTaskId: string
): DependencyGraph
```

## Control Loop Refactoring

### 1. Parallel Execution Manager

**File**: `src/parallelExecutor.ts` (NEW)

```typescript
export interface TaskExecution {
  task: Task;
  promise: Promise<TaskExecutionResult>;
  startedAt: number;
  iteration: number;
}

export interface TaskExecutionResult {
  task: Task;
  cursorResult: CursorResult;
  validationReport: ValidationReport;
  success: boolean;
}

// Execute multiple tasks in parallel
export async function executeTasksInParallel(
  tasks: Task[],
  maxConcurrency: number,
  cursorCLI: CursorCLI,
  validator: Validator,
  promptBuilder: PromptBuilder,
  sandboxRoot: string,
  state: SupervisorState
): Promise<TaskExecutionResult[]>

// Wait for first task to complete (for control loop)
export async function waitForFirstCompletion(
  executions: TaskExecution[]
): Promise<{ result: TaskExecutionResult; remaining: TaskExecution[] }>
```

### 2. Control Loop Changes

**File**: `src/controlLoop.ts`

Major refactoring of control loop:

**Current Flow:**
```
1. Load state
2. Dequeue one task
3. Process task
4. Complete task
5. Persist state
6. Repeat
```

**New Flow:**
```
1. Load state
2. Check in-flight tasks (if any completed, handle completion)
3. Promote waiting tasks to ready (if dependencies met)
4. Dequeue ready tasks (up to 3, respecting max concurrency)
5. Start parallel execution
6. Wait for first completion
7. Handle completion (validation, state update, queue promotion)
8. Persist state
9. Repeat
```

**Key Changes:**
- Track `in_flight_tasks` in state
- Process multiple tasks concurrently
- Handle completions asynchronously
- Promote waiting tasks when dependencies complete
- Update dependency graph on each completion

## Enqueue Validation

### 1. Enhanced Enqueue Function

**File**: `src/cli.ts`

Update `enqueue` function to:
1. Validate all dependencies exist in task list
2. Detect circular dependencies
3. Build initial dependency graph
4. Place tasks in appropriate queue (ready/waiting)
5. Store dependency graph in state

```typescript
async function enqueue(
  client: Redis,
  queueName: string,
  queueDbIndex: number,
  taskFile: string
): Promise<void> {
  // ... existing task loading ...
  
  // 1. Validate dependencies exist
  const allTaskIds = tasks.map(t => t.task_id);
  for (const task of tasks) {
    const validation = validateDependenciesExist(task, allTaskIds);
    if (!validation.valid) {
      throw new Error(`Task ${task.task_id} has invalid dependencies: ${validation.missing.join(', ')}`);
    }
  }
  
  // 2. Detect circular dependencies
  const cycleCheck = detectCircularDependencies(tasks);
  if (cycleCheck.hasCycle) {
    throw new Error(`Circular dependency detected: ${cycleCheck.cycle?.join(' → ')}`);
  }
  
  // 3. Build dependency graph
  const dependencyGraph = buildDependencyGraph(tasks);
  
  // 4. Load state to get completed tasks
  const state = await loadState(client, stateKey);
  const completedTaskIds = state.completed_tasks?.map(t => t.task_id) || [];
  
  // 5. Enqueue to appropriate queue
  const readyQueueKey = getReadyQueueKey(queueName);
  const waitingQueueKey = getWaitingQueueKey(queueName);
  
  for (const task of tasks) {
    const queueType = await enqueueTaskWithDependencies(
      queueClient,
      readyQueueKey,
      waitingQueueKey,
      task,
      completedTaskIds
    );
    // Log which queue task went to
  }
  
  // 6. Update state with dependency graph
  state.dependency_graph = dependencyGraph;
  await persistState(client, stateKey, state);
}
```

## Runtime Dependency Checking

### 1. Pre-Execution Validation

**File**: `src/controlLoop.ts`

Before starting task execution:
1. Re-check dependencies (runtime validation)
2. Verify task is still in ready queue
3. Ensure no circular dependencies introduced

```typescript
// Before starting task execution
function validateTaskReady(
  task: Task,
  completedTaskIds: string[],
  dependencyGraph: DependencyGraph
): { ready: boolean; reason?: string } {
  // Check hard dependencies
  const hardDepsCheck = checkHardDependencies(task, completedTaskIds);
  if (!hardDepsCheck) {
    return { ready: false, reason: 'Hard dependencies not met' };
  }
  
  // Runtime cycle check (defensive)
  // ... cycle detection logic ...
  
  return { ready: true };
}
```

## Queue Promotion Logic

### 1. Automatic Promotion

**File**: `src/controlLoop.ts`

When a task completes:
1. Update dependency graph
2. Find all waiting tasks that depend on completed task
3. Check if their dependencies are now met
4. Move from waiting to ready queue
5. Log promotion events

```typescript
async function promoteTasksOnCompletion(
  completedTaskId: string,
  queue: QueueAdapter,
  state: SupervisorState
): Promise<string[]> {
  if (!state.dependency_graph) {
    return [];
  }
  
  // Update graph
  state.dependency_graph = updateDependencyGraph(
    state.dependency_graph,
    completedTaskId
  );
  
  // Find dependent tasks
  const dependentTasks = findDependentTasks(
    completedTaskId,
    state.dependency_graph
  );
  
  // Check each dependent task
  const completedIds = state.completed_tasks?.map(t => t.task_id) || [];
  const promoted: string[] = [];
  
  for (const dependentTask of dependentTasks) {
    if (dependentTask.queue_location === 'waiting') {
      const allHardMet = checkHardDependencies(
        dependentTask,
        completedIds
      );
      
      if (allHardMet) {
        // Move from waiting to ready
        await queue.promoteTask(dependentTask.task_id);
        promoted.push(dependentTask.task_id);
      }
    }
  }
  
  return promoted;
}
```

## Parallel Execution Implementation

### 1. Execution Slot Management

**File**: `src/controlLoop.ts`

```typescript
// Calculate available execution slots
function getAvailableSlots(
  maxConcurrency: number,
  inFlightTasks: InFlightTask[]
): number {
  return Math.max(0, maxConcurrency - (inFlightTasks?.length || 0));
}

// Start task execution (non-blocking)
async function startTaskExecution(
  task: Task,
  // ... other params ...
): Promise<TaskExecution> {
  // Build prompt
  // Start Cursor CLI execution
  // Return execution promise
}

// Main parallel execution loop
while (true) {
  // 1. Check for completed in-flight tasks
  const completed = await checkInFlightCompletions(inFlightTasks);
  
  // 2. Handle completions
  for (const result of completed) {
    // Validate, update state, promote waiting tasks
  }
  
  // 3. Promote waiting tasks
  const promoted = await promoteTasksOnCompletion(...);
  
  // 4. Calculate available slots
  const availableSlots = getAvailableSlots(3, inFlightTasks);
  
  // 5. Dequeue ready tasks (up to available slots)
  if (availableSlots > 0) {
    const readyTasks = await queue.dequeueReadyTasks(availableSlots);
    
    // 6. Start parallel executions
    for (const task of readyTasks) {
      const execution = await startTaskExecution(task, ...);
      inFlightTasks.push({
        task_id: task.task_id,
        started_at: new Date().toISOString(),
        iteration: iteration,
      });
    }
  }
  
  // 7. Wait for at least one completion (if any in-flight)
  if (inFlightTasks.length > 0) {
    await waitForFirstCompletion(inFlightTasks);
  } else {
    // No tasks in flight, check if queue exhausted
    // ...
  }
}
```

## State Persistence Updates

### 1. Enhanced State Persistence

**File**: `src/persistence.ts`

Ensure dependency graph and in-flight tasks are properly serialized/deserialized.

## Error Handling

### 1. Dependency Errors

- **Invalid dependency**: Throw error at enqueue time
- **Circular dependency**: Throw error at enqueue time, runtime check as fallback
- **Missing dependency at runtime**: Mark task as blocked, log error

### 2. Parallel Execution Errors

- **Task failure**: Handle individually, don't stop other parallel tasks
- **State corruption**: Halt supervisor, require operator intervention
- **Queue corruption**: Validate queue state, attempt recovery

## Migration Strategy

### 1. Backward Compatibility

- Existing tasks without `depends_on` field work as before
- Single queue mode (if no dependencies) for backward compatibility
- Gradual migration path

### 2. State Migration

- Detect old state format
- Initialize dependency graph from existing tasks
- Migrate single queue to dual queue system

## Testing Considerations

1. **Dependency Validation**:
   - Test valid dependencies
   - Test invalid dependencies (missing task_id)
   - Test circular dependencies (simple and complex cycles)

2. **Queue Promotion**:
   - Test single dependency completion
   - Test multiple dependencies (all must complete)
   - Test soft dependencies (can proceed without)

3. **Parallel Execution**:
   - Test single task (sequential mode)
   - Test 2-3 concurrent tasks
   - Test task completion order
   - Test failure handling (one fails, others continue)

4. **State Consistency**:
   - Test dependency graph accuracy
   - Test in-flight task tracking
   - Test state persistence under parallel execution

## Performance Considerations

1. **Queue Operations**:
   - Dual queue adds overhead (two Redis operations)
   - Promotion requires scanning waiting queue
   - Consider indexing or caching for large queues

2. **Parallel Execution**:
   - Max 3 concurrent tasks limits resource usage
   - Each task uses Cursor CLI (external process)
   - Monitor system resources (CPU, memory)

3. **Dependency Graph**:
   - Graph size grows with task count
   - Update operations need to be efficient
   - Consider graph pruning (remove completed nodes)

## Implementation Steps

### Phase 1: Foundation (Dependencies Only)
1. Add `depends_on` field to Task interface
2. Create dependency validation functions
3. Implement dual queue system
4. Add dependency graph to state
5. Update enqueue to validate and build graph
6. Implement queue promotion logic

### Phase 2: Parallel Execution
7. Create parallel executor module
8. Refactor control loop for parallel execution
9. Implement in-flight task tracking
10. Add completion handling for parallel tasks
11. Update state persistence

### Phase 3: Testing & Refinement
12. Add comprehensive tests
13. Performance optimization
14. Error handling improvements
15. Documentation updates

## Files to Create/Modify

### New Files:
1. `src/dependencyValidator.ts` - Dependency validation and graph management
2. `src/parallelExecutor.ts` - Parallel task execution management

### Modified Files:
1. `src/types.ts` - Add dependency types and state enhancements
2. `src/queue.ts` - Dual queue implementation
3. `src/controlLoop.ts` - Major refactoring for parallel execution
4. `src/cli.ts` - Enhanced enqueue validation
5. `src/persistence.ts` - Handle new state fields

## Rollback Plan

If issues occur:
1. Halt supervisor
2. Revert to single queue mode (feature flag)
3. Process tasks sequentially
4. Restore from backup state if needed

## Open Questions / Decisions Needed

1. **Soft Dependency Behavior**: If soft dependency not met, should task:
   - Proceed anyway (current plan)
   - Wait with lower priority
   - Log warning and proceed

2. **Max Concurrency Configuration**: Should max concurrency be:
   - Fixed at 3 (current plan)
   - Configurable per project
   - Dynamic based on system resources

3. **Graph Pruning**: Should we:
   - Keep full graph forever
   - Prune completed nodes after N completions
   - Archive old graph data

4. **Queue Promotion Efficiency**: For large waiting queues, should we:
   - Scan entire queue on each completion
   - Maintain index of dependencies
   - Use Redis sets for faster lookups

