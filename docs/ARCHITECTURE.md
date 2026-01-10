# Architecture

## Role Separation

Implement the following roles as distinct modules/concerns:

### Operator Interface
- Injects initial goal
- Injects tasks
- Issues HALT / RESUME

### Foundry Core (formerly Supervisor Core)
- Owns control loop
- Owns state read/write
- Owns validation (deterministic pre-checks, helper orchestration, session reuse)

### Tool Dispatcher
- Constructs task prompts for Agents/Providers (Gemini, Copilot, Cursor)
- Injects state snapshots and applies path validation

### Persistence Layer
- DragonflyDB read/write only

### Queue Adapter
- Redis list-based queue (provider-agnostic)

### Additional Components (current)
- DeterministicValidator: fast non-AI checks with regex/semver and safety caps.
- Helper Agent pipeline: invoked on validation gaps; sessions isolated per project.
- SessionManager: resolves/resumes sessions per feature; enforces context/error limits.
- AnalyticsService: records helper durations, cache hit rate, deterministic attempts/success to JSONL.
- ValidationCache/ASTService: Redis-backed validation caching and structural code analysis.

No module may cross responsibilities.