# Queue System

- Task queue is implemented using Redis Lists (LPUSH/RPOP).
- Queue runs on top of DragonflyDB (numbered database instance, e.g., db 2 or 3).
- No Lua scripts required (compatible with DragonflyDB constraints).
- Tasks are queued from operator instructions.
- Supervisor control loop consumes tasks from queue (FIFO order).
- Queue integration with supervisor state management.

