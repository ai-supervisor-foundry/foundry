# Architecture

## Role Separation

Implement the following roles as distinct modules/concerns:

### Operator Interface
- Injects initial goal
- Injects tasks
- Issues HALT / RESUME

### Supervisor Core
- Owns control loop
- Owns state read/write
- Owns validation

### Tool Dispatcher
- Constructs Cursor task prompts
- Injects state snapshots

### Persistence Layer
- DragonflyDB read/write only

### Queue Adapter
- BullMQ integration only

No module may cross responsibilities.

