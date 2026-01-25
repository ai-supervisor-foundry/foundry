# V2 Module: The Parallel Scheduler

**Status:** Planned
**Priority:** High (Phase 2)
**Based on:** `docs/plans/task-dependencies-parallel-execution.md`

## 1. Overview
The current Supervisor processes tasks sequentially (FIFO). This is inefficient for workflows like "Create 5 independent microservices" or "Write tests for 10 files".

V2 introduces a **Task Dependency Graph (DAG)** and a **Parallel Worker Pool**. This allows Foundry to maximize resource utilization (LLM tokens + IO) by running independent tasks concurrently.

## 2. Architecture: The Dual-Queue System

Instead of a single `tasks` list, we maintain two distinct queues in DragonflyDB:

### A. The Waiting Queue (`queue:waiting`)
- **Contains:** Tasks with *unmet dependencies*.
- **State:** `BLOCKED`.
- **Action:** Passive. Checked only when a task completes.

### B. The Ready Queue (`queue:ready`)
- **Contains:** Tasks with *all dependencies met* (or no dependencies).
- **State:** `PENDING`.
- **Action:** Active. Polled by the Worker Pool.

## 3. The Control Loop Refactor

The monolithic `ControlLoop` splits into two components:

### Component 1: The Scheduler (The Brain)
Runs on every "Task Completed" event.
1.  **Update Graph:** Mark task $T$ as completed.
2.  **Check Dependents:** Find all tasks $D$ where $T \in D.depends\_on$.
3.  **Promote:** For each $D$, if *all* dependencies are now complete:
    - Atomic Move: `Waiting` -> `Ready`.
    - Emit Event: `TASK_PROMOTED`.

### Component 2: The Worker Pool (The Muscles)
A configurable set of workers (default: 3).
1.  **Poll:** `BRPOP` from `queue:ready`.
2.  **Lock:** Acquire execution lock for the task.
3.  **Execute:** Spawn `Agent` context.
    - *Note:* Each worker gets its own `Agent` instance (context window).
4.  **Report:** Write result to State. Emit `TASK_COMPLETED`.

## 4. Data Structures

**Task Schema Update:**
```json
{
  "id": "task-123",
  "depends_on": ["task-100", "task-101"],
  "status": "waiting" | "ready" | "running" | "completed",
  "parallel_group_id": "group-abc" // Optional: visual grouping
}
```

**State Schema Update:**
```typescript
interface SupervisorState {
  // ...
  dependency_graph: {
    nodes: Record<TaskId, TaskNode>;
    edges: Edge[];
  };
  queue: {
    ready: TaskId[];
    waiting: TaskId[];
  };
  active_workers: number;
}
```

## 5. Concurrency Control (The Hard Part)

**File System Races:**
If Task A and Task B both try to edit `README.md` simultaneously, we have a race condition.

**Solution: Resource Locking (Optimistic)**
- Tasks can optionally declare `resources: ["README.md"]`.
- Scheduler checks resource availability before promoting to `Ready`.
- *MVP:* We assume agents working on different files (e.g., "Create Component A", "Create Component B") won't collide. If they do, standard Git merge conflict resolution (or overwrite) applies. We accept this risk for Phase 2.

## 6. Implementation Plan

### Step 1: Data Migration
- [ ] Update `TASK_SCHEMA.json`.
- [ ] Add `waiting` queue to Redis adapter.

### Step 2: Scheduler Logic
- [ ] Implement `DependencyGraph` class.
- [ ] Implement `promoteReadyTasks()` function.

### Step 3: Worker Pool
- [ ] Refactor `ControlLoop.ts` to support `max_concurrent_tasks` config.
- [ ] Ensure `Agent` instances are isolated (no shared memory variables).

## 7. UX Implications
The UI must visualize the DAG.
- **Visual:** A tree or node graph showing dependencies.
- **Status:** "Waiting for Task-123" vs "Queued".
