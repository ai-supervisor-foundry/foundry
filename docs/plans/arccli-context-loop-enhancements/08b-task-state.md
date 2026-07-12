# 08b — Task State Machine & Registry

## Source Files
- `crates/arc-a2a/src/task.rs` — TaskRegistry, state machine, watchers

## Task State Machine

```typescript
type TaskState = 'submitted' | 'working' | 'input_required'
  | 'completed' | 'failed' | 'canceled';

const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  submitted:      ['working', 'canceled'],
  working:        ['input_required', 'completed', 'failed', 'canceled'],
  input_required: ['working', 'canceled'],
  completed:      [],               // terminal
  failed:         [],               // terminal
  canceled:       [],               // terminal
};
```

## Tracked Task

```typescript
interface TrackedTask {
  taskId: string;
  skillId: string;
  state: TaskState;
  requesterId: string;
  input: unknown;
  output: unknown | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  progress: number;              // 0.0 - 1.0
  statusMessage: string;
  error: string | null;
}
```

## Task Registry

```typescript
class TaskRegistry {
  private tasks = new Map<string, TrackedTask>();
  private watchers = new Map<string, EventEmitter>();

  register(task: TrackedTask): EventEmitter {
    this.tasks.set(task.taskId, task);
    const emitter = new EventEmitter();
    this.watchers.set(task.taskId, emitter);
    return emitter;
  }

  transition(taskId: string, newState: TaskState): void {
    const task = this.tasks.get(taskId)!;
    if (!VALID_TRANSITIONS[task.state].includes(newState))
      throw new Error(`Invalid: ${task.state} → ${newState}`);
    task.state = newState;
    this.watchers.get(taskId)?.emit('state', newState);
  }

  updateProgress(taskId: string, progress: number, message: string): void { }
  complete(taskId: string, output: unknown): void { }
  fail(taskId: string, error: string): void { }
  gcIfNeeded(): void { /* evict oldest terminal tasks over maxHistory */ }
}
```

Capacity check: reject with 429 when `activeCount >= maxConcurrentTasks`.

## Acceptance Criteria

- [ ] State machine with validated transitions
- [ ] TaskRegistry with EventEmitter-based watchers
- [ ] 429 backpressure when at capacity limit
- [ ] GC of terminal tasks keeps memory bounded
