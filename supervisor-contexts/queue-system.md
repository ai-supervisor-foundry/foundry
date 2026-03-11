# Queue System

## Implementation

- Task queue uses **Redis Lists** (LPUSH/RPOP)
- Queue runs on top of DragonflyDB (numbered database instance, e.g., db 2)
- **No Lua scripts required** (compatible with DragonflyDB constraints)
- Tasks are queued from operator instructions
- Supervisor control loop consumes tasks from queue (**FIFO order**)
- Queue key format: `queue:${queueName}`

## Queue Operations

- **Enqueue**: `LPUSH queue:tasks <task_json>` (adds to left/head of list)
- **Dequeue**: `RPOP queue:tasks` (removes from right/tail of list)
- **Peek**: `LRANGE queue:tasks 0 -1` (read-only, no mutation)

## Task Processing Order

Tasks are processed in **strict FIFO (First In, First Out) order**:
- Tasks enqueued first are processed first
- Uses Redis List with LPUSH (left push) for enqueue and RPOP (right pop) for dequeue
- This ensures the first task added to the queue is the first task processed
- **Exception**: If a task fails and is stored in `retry_task` state, it takes priority over the queue and will be retried before processing the next queued task
