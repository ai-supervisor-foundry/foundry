# Architecture

## Role Separation

The system is organized into distinct modules with clear responsibilities:

### Operator Interface (`src/cli.ts`)
- Injects initial goal
- Injects tasks
- Issues HALT / RESUME commands
- Manages supervisor lifecycle

### Supervisor Core (`src/controlLoop.ts`)
- Owns control loop
- Owns state read/write
- Owns validation orchestration
- Manages task lifecycle

### Tool Dispatcher (`src/domain/agents/`, `src/infrastructure/connectors/agents/providers/`)
- Constructs provider task prompts
- Injects state snapshots
- Manages CLI provider selection (Gemini, Copilot, Cursor, Claude, Codex)
- Handles circuit breaker and fallback logic

### Persistence Layer (`src/persistence.ts`)
- DragonflyDB read/write only
- State serialization/deserialization
- Atomic state updates

### Queue Adapter (`src/queue.ts`)
- Redis List-based queue (LPUSH/RPOP)
- FIFO task ordering
- Queue state management

### Validator (`src/validator.ts`)
- Deterministic, rule-based validation
- File existence checks
- Content pattern matching
- Test execution
- Keyword-based criterion matching

### Audit Logger (`src/auditLogger.ts`)
- Append-only JSONL logging
- State diffs
- Event tracking
- Task lifecycle events

### Logger (`src/logger.ts`)
- Centralized verbose logging
- PM2-compatible stdout flushing
- Performance metrics
- State transition tracking

**No module may cross responsibilities.**
