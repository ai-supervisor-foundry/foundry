# Foundry

**The Persistent Control Plane for Autonomous AI Software Factories.**

## What This Is

**Foundry** is a deterministic orchestration engine that transforms ephemeral AI coding agents into reliable, long-running software developers. Unlike transient chat assistants, Foundry externalizes project state, memory, and intent into a persistent layer (DragonflyDB), enabling it to execute complex, multi-day engineering goals without context loss.

Acting as a strict control plane, it manages a **Software Factory** workflow where **you define the goal and break it into explicit tasks**, which Foundry then autonomously dispatches to provider CLIs (Cursor, Gemini, Copilot) and rigorously validates before progression. With features like sandbox isolation, deterministic output validation, and auto-recovery from ambiguity, Foundry ensures that AI development is audit-safe, restartable, and strictly aligned with operator intent.

### Software Factory Concept

Foundry operates like a **software factory** or **Replit-like environment** where you provide:

1. **Code Boilerplates**: Initial project structure, existing codebase, or starter templates (placed in `sandbox/<project-id>/`)
2. **Tasks**: Explicit task definitions with acceptance criteria (what needs to be built)
3. **Goal**: High-level project objective (what the project should achieve)

Foundry then **autonomously works on the project** by:
- Executing tasks sequentially in the sandbox environment
- Building upon existing code and boilerplates
- Validating each task's completion
- Maintaining persistent state across sessions
- Continuing work until the goal is achieved or tasks are exhausted

**Workflow**:
```
Operator provides:
  ├─ Code Boilerplates (in sandbox/<project-id>/)
  ├─ Tasks (via enqueue command)
  └─ Goal (via set-goal command)
         ↓
Foundry autonomously:
  ├─ Executes tasks in order
  ├─ Works with existing code
  ├─ Validates outputs
  ├─ Persists state
  └─ Continues until goal met or halted
```

This enables a **"set it and forget it"** workflow where you provide the foundation (boilerplates), the plan (tasks), and the destination (goal), then Foundry builds the project autonomously.

## The Problem It Solves

AI coding agents are powerful but ephemeral—context is lost on interruption, making long-running projects difficult. Foundry provides:
- **Persistence**: State survives crashes, restarts, and interruptions
- **Deterministic Control**: No surprises—explicit validation, clear halt conditions
- **Long-Running Projects**: Work on complex projects over days or weeks
- **Full Auditability**: Every action is logged and reviewable
- **Cost-Effective**: Uses free tier tools (provider CLIs, DragonflyDB)

## How It Works

Foundry operates as a **strict control mechanism** that executes operator-defined tasks through a fixed control loop. It maintains persistent state in DragonflyDB (Redis-compatible), manages a FIFO task queue, dispatches tasks to your chosen Agents/Providers (Gemini, Copilot, Cursor) with injected state context, and validates outputs deterministically. The system enforces sandbox isolation per project, provides append-only audit logging, and supports recovery from crashes or restarts by reloading persisted state. Foundry never invents goals, expands scope, or makes autonomous decisions—all authority remains with the operator who injects goals and tasks explicitly.

### Execution Stages (Current)
- **Deterministic pre-validation**: Fast, non-AI checks (semver/regex), safe regex guard, file/byte caps; can skip helper when confidence is high. Flags: `HELPER_DETERMINISTIC_ENABLED`, `HELPER_DETERMINISTIC_PERCENT`.
- **Provider run**: Task dispatched to Agents/Providers (Gemini, Copilot, Cursor) with state/context injection and session reuse when available.
- **Helper agent fallback**: Generates verification commands when deterministic checks are insufficient; helper sessions are reused per project feature to retain context.
- **Analytics & metrics**: JSONL metrics (helper durations avg/p95, cache-hit rate, deterministic attempts/success) persisted alongside audit logs.

### Session Reuse
- Session IDs resolved per feature (`task:prefix` or `project:<id>`) with caps and error thresholds.
- Helper sessions isolated under `helper:validation:<projectId>` and persisted in `state.active_sessions`.
- Toggle via `DISABLE_SESSION_REUSE` if rollback is required.

## Overview

Foundry is a **control mechanism** that:
- Holds externally injected goals
- Maintains persistent state
- Executes a fixed control loop
- Delegates tasks to provider/agent CLIs
- Validates results
- Retries on validation failures and ambiguity (up to max retries)
- Halts only on critical failures (execution errors, blocked status)

It does **not**:
- Invent goals
- Act independently
- Replace the operator
- Make autonomous decisions

## Installation

### Prerequisites

- **Node.js**: LTS version (install via [nvm](https://github.com/nvm-sh/nvm))
- **Docker & Docker Compose**: For running DragonflyDB
- **Provider CLI(s)**: Install at least one supported provider CLI (e.g., Gemini, Copilot, Cursor). Cursor-specific docs: [Cursor CLI](https://cursor.com/cli)

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

## Infrastructure Setup

### Start DragonflyDB

Foundry uses DragonflyDB (Redis-compatible) for state persistence and task queuing.

1. **Start DragonflyDB container**:
   ```bash
   docker-compose up -d
   ```

2. **Verify DragonflyDB is running**:
   ```bash
   docker ps | grep dragonflydb
   # Should show container running on port 6499
   ```

3. **Test connection** (optional):
   ```bash
   redis-cli -h localhost -p 6499 ping
   # Should return: PONG
   ```

### Stop DragonflyDB

```bash
docker-compose down
```

To remove data volume:
```bash
docker-compose down -v
```

## Usage

### Software Factory Workflow

The typical workflow follows this pattern:

1. **Prepare Code Boilerplates** (optional but recommended)
2. **Initialize Foundry State**
3. **Set Goal**
4. **Enqueue Tasks**
5. **Start Foundry** (autonomous execution)

### 0. Prepare Code Boilerplates (Optional)

Before starting Foundry, you can prepare initial code in the sandbox directory:

```bash
# Create project directory
mkdir -p sandbox/my-project

# Copy boilerplate/starter code
cp -r my-boilerplate/* sandbox/my-project/

# Or initialize a new project structure
cd sandbox/my-project
npm init -y
# ... add initial files, dependencies, etc.
```

**What to include in boilerplates**:
- Project structure (directories, config files)
- Initial dependencies (`package.json`, `requirements.txt`, etc.)
- Starter templates (React components, API routes, etc.)
- Configuration files (`.env.example`, `tsconfig.json`, etc.)
- Existing codebase (if continuing work on an existing project)

Foundry will **work with and build upon** this existing code. Tasks can reference existing files, extend functionality, or create new features.

**Example**: If you have a React boilerplate with `src/App.tsx`, tasks can extend it:
```json
{
  "task_id": "add-auth",
  "instructions": "Extend the existing App.tsx component to add user authentication. The component is located at src/App.tsx and uses React Router. Follow the existing code style and patterns.",
  ...
}
```

### 1. Initialize Foundry State

Before using Foundry, initialize the state key:

```bash
npm run cli -- init-state \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --execution-mode AUTO
```

**Parameters**:
- `--redis-host`: DragonflyDB host (default: `localhost`)
- `--redis-port`: DragonflyDB port (default: `6499`)
- `--state-key`: Fixed key name for state (operator-defined)
- `--queue-name`: Task queue name
- `--queue-db`: Database index for queue (must differ from state DB, default: `2`)
- `--state-db`: Database index for state (default: `0`)
- `--execution-mode`: `AUTO` or `MANUAL` (default: `AUTO`)

### 2. Set Goal

Define the goal Foundry will work towards:

```bash
npm run cli -- set-goal \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --description "A simplified, senior-friendly classifieds super app built with React and Tailwind CSS that aggregates property and vehicle listings into a single, accessible mobile-first experience. The platform combines a robust backend aggregation and scraping system that continuously collects, normalizes, and enriches listings from multiple external sources with a subscription-based daily curated feed that prioritizes relevance, freshness, and user preferences. Featuring phone-only authentication, clear navigation, large readable UI elements, and intelligent search, the system is designed to reduce noise and complexity for end users while delivering a reliable, scalable, and continuously updated marketplace, with the frontend located in ./sandbox/easeclassifieds and the backend and aggregation services in ./sandbox/easeclassifieds-api." \
  --project-id easeclassifieds
```

**Parameters**:
- `--description`: Goal description (required)
- `--project-id`: Project identifier (optional, used for sandbox directory)

**Important**: The `--project-id` should match the directory name in `sandbox/` where your boilerplates are located (e.g., if you created `sandbox/my-project/`, use `--project-id my-project`).

### 3. Create Task File(s)

Create task JSON file(s) following the task schema. You can create either:
- **Single task file**: Contains one task object
- **Array of tasks file**: Contains an array of task objects (all enqueued at once)

**Example: Single task file `task-1.json`**
```json
{
  "task_id": "task-001",
  "intent": "Create API endpoint structure",
  "tool": "gemini",
  "instructions": "Create a REST API with Express.js. Include routes for /api/v1/users and /api/v1/auth. Use TypeScript.",
  "acceptance_criteria": [
    "Express server starts on port 3000",
    "Routes /api/v1/users and /api/v1/auth exist",
    "TypeScript configuration is present",
    "package.json includes express and @types/express"
  ],
  "retry_policy": {
    "max_retries": 2
  },
  "status": "pending",
  "working_directory": "my-backend-api",
  "required_artifacts": [
    "src/server.ts",
    "src/routes/users.ts",
    "src/routes/auth.ts",
    "tsconfig.json",
    "package.json"
  ],
  "test_command": "npm run test",
  "tests_required": false
}
```

**Example: Array of tasks file `tasks.json`**

Tasks can reference existing files from your boilerplates. For example:
```json
[
  {
    "task_id": "frontend-001",
    "intent": "Extend existing React component",
    "tool": "gemini",
    "instructions": "Extend the existing App.tsx component (located at src/App.tsx) to add user authentication. Follow the existing code style and patterns.",
    "acceptance_criteria": [
      "App.tsx includes authentication logic",
      "Uses existing React Router setup",
      "Follows existing code style"
    ],
    "retry_policy": {
      "max_retries": 2
    },
    "status": "pending"
  },
  {
    "task_id": "backend-001",
    "intent": "Create API endpoint structure",
    "tool": "copilot",
    "instructions": "Create a REST API with Express.js. Include routes for /api/v1/users and /api/v1/auth. Use TypeScript.",
    "acceptance_criteria": [
      "Express server starts on port 3000",
      "Routes /api/v1/users and /api/v1/auth exist",
      "TypeScript configuration is present",
      "package.json includes express and @types/express"
    ],
    "retry_policy": {
      "max_retries": 2
    },
    "status": "pending",
    "working_directory": "my-backend-api",
    "required_artifacts": [
      "src/server.ts",
      "src/routes/users.ts",
      "src/routes/auth.ts",
      "tsconfig.json",
      "package.json"
    ],
    "tests_required": false
  },
  {
    "task_id": "backend-002",
    "intent": "Add authentication middleware",
    "tool": "claude",
    "instructions": "Implement JWT authentication middleware for Express routes.",
    "acceptance_criteria": [
      "JWT middleware validates tokens",
      "Protected routes require authentication",
      "Middleware handles expired tokens"
    ],
    "retry_policy": {
      "max_retries": 2
    },
    "status": "pending",
    "working_directory": "my-backend-api",
    "required_artifacts": [
      "src/middleware/auth.ts"
    ],
    "tests_required": false
  }
]
```

**Task Schema Fields**:
- `task_id`: Unique identifier
- `intent`: Brief description of task purpose
- `tool`: Provider/agent to execute the task (`cursor`, `gemini`, `gemini_stub`, `copilot`, `codex`, `claude`)
- `instructions`: Detailed instructions for the selected provider CLI
- `acceptance_criteria`: Array of strings, ALL must be met
- `retry_policy`: Retry configuration (typically `max_retries: 3`)
- `status`: Initial status (typically `"pending"`)
- `working_directory`: Optional relative path from sandboxRoot (overrides project_id-based default)
- `required_artifacts`: Array of file paths (relative to sandbox project directory, optional)
- `test_command`: Command to run for validation (optional)
- `tests_required`: Whether tests must pass (boolean, optional)

**Recommended file organization**:
```
supervisor/
├── tasks/              # Task files directory
│   ├── task-001.json   # Single task
│   ├── task-002.json   # Single task
│   └── tasks.json      # Array of tasks
├── src/
└── sandbox/
```

### 4. Enqueue Tasks

Add tasks to the queue. The `enqueue` command supports both single task objects and arrays:

**Enqueue a single task file**:
```bash
npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/task-001.json
```

**Enqueue an array of tasks from one file**:
```bash
npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/tasks.json
```

All tasks will be enqueued in the order they appear (FIFO execution). Tasks are processed in strict First-In-First-Out order: the first task enqueued is the first task processed. The queue uses Redis List with LPUSH (left push) for enqueue and RPOP (right pop) for dequeue to maintain FIFO ordering.

### 5. Start Foundry Control Loop

Run the Foundry control loop (this will process tasks until queue is exhausted or halted):

```bash
npm run cli -- start \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

Foundry will:
1. Load state
2. Check if status is RUNNING (if not, set it with `resume` command first)
3. Dequeue next task
4. Dispatch to the configured provider CLI
5. Validate output
6. Persist state
7. Repeat until queue exhausted or halted

**Note**: The `resume` command only sets the status to RUNNING. Use `start` to actually run the control loop.

### 6. Monitor Execution

**Check Foundry status** (recommended):
```bash
npm run cli -- status \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

This displays:
- Foundry status and iteration
- Goal information and completion status
- Queue status
- Task statistics (completed, blocked)
- Last validation report
- Execution mode and metadata

**Check audit logs**:
```bash
cat sandbox/<project-id>/audit.log.jsonl | tail -20
```

**View verbose application logs** (PM2):
```bash
# View all logs (stdout + stderr)
pm2 logs supervisor --lines 100

# View only stdout
pm2 logs supervisor --out --lines 100

# Follow logs in real-time
pm2 logs supervisor --follow

# View logs from log files directly
tail -f logs/supervisor-out.log
tail -f logs/supervisor-error.log
```

Verbose logs include:
- `[VERBOSE]` - Detailed application logic and state information
- `[PERFORMANCE]` - Operation timing and performance metrics
- `[STATE_TRANSITION]` - State changes and transitions
- Standard iteration and task processing logs

**Alternative: Check status via redis-cli**:
```bash
redis-cli -h localhost -p 6499 GET supervisor:state | jq '.supervisor.status'
```

**View current task**:
```bash
redis-cli -h localhost -p 6499 GET supervisor:state | jq '.current_task'
```

### 7. Halt Foundry

To stop execution (e.g., on ambiguity or operator intervention):

```bash
npm run cli -- halt \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --reason "Operator intervention"
```

### 8. Resume After Halt

After resolving issues, first set status to RUNNING, then start the control loop:

```bash
# Set status to RUNNING
npm run cli -- resume \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2

# Start the control loop
npm run cli -- start \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

## Complete Workflow Example

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Initialize Foundry
npm run cli -- init-state \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --execution-mode AUTO

# 3. Set goal
npm run cli -- set-goal \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --description "Build microservice with 3 endpoints" \
  --project-id my-service

# 4. Create and enqueue tasks
# Option A: Enqueue single task files
npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/task-1.json

npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/task-2.json

# Option B: Enqueue array of tasks from one file
npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/all-tasks.json

# 5. Start Foundry control loop
npm run cli -- start \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2

# 6. Monitor (in another terminal)
# View audit logs
tail -f sandbox/my-service/audit.log.jsonl

# Or view verbose application logs
pm2 logs supervisor --follow
```

## Architecture

- **Operator Interface** (`src/infrastructure/tooling/project-cli/cli.ts`): CLI commands for operator control
- **Foundry Core** (`src/application/entrypoint/controlLoop.ts`): Main control loop
- **Tool Dispatcher** (`src/infrastructure/connectors/agents/providers/*`, `src/domain/agents/promptBuilder.ts`): CLI integration
- **Persistence Layer** (`src/application/services/persistence.ts`): DragonflyDB state management
- **Queue Adapter** (`src/domain/executors/taskQueue.ts`): Redis List-based task queue
- **Validator** (`src/application/services/validator.ts`): Deterministic validation
- **AST Service** (`src/application/services/ASTService.ts`): Structural code analysis
- **Validation Cache** (`src/application/services/validationCache.ts`): Redis-based result caching
- **Analytics Service** (`src/application/services/analytics.ts`): Performance tracking
- **Audit Logger** (`src/infrastructure/adapters/logging/auditLogger.ts`): Append-only logging
- **Logger** (`src/infrastructure/adapters/logging/logger.ts`): Centralized verbose logging with stdout flushing for PM2

## Documentation

All specifications and documentation are in the `docs/` directory:

- [Control Loop](docs/LOOP.md) - Control loop steps
- [State Management](docs/STATE_LIFECYCLE.md) - State lifecycle rules
- [Tool Contracts](docs/TOOL_CONTRACTS.md) - Provider/agent contract
- [Validation](docs/VALIDATION.md) - Validation rules
- [Sandbox](docs/SANDBOX.md) - Sandbox enforcement
- [Recovery](docs/RECOVERY.md) - Recovery scenarios
- [Runbook](docs/RUNBOOK.md) - Operational procedures

See [docs/IMPLEMENTATION_REVIEW.md](docs/IMPLEMENTATION_REVIEW.md) for implementation status.

## State Schema

- [State Schema](STATE_SCHEMA.json) - Foundry state structure
- [Task Schema](TASK_SCHEMA.json) - Task structure

## Configuration

### Environment Variables

Set these before running commands:

```bash
export CURSOR_CLI_PATH=/path/to/cursor  # Optional, only if using Cursor CLI (defaults to 'cursor agent')
```

### CLI Global Options

All commands require these global options:

- `--redis-host <host>` - DragonflyDB host (required, default: `localhost`)
- `--redis-port <port>` - DragonflyDB port (required, default: `6499`)
- `--state-key <key>` - State key (required, operator-defined, e.g., `supervisor:state`)
- `--queue-name <name>` - Task queue name (required, e.g., `tasks`)
- `--queue-db <index>` - Queue database index (required, must differ from state DB, e.g., `2`)
- `--state-db <index>` - State database index (optional, default: `0`)
- `--sandbox-root <path>` - Sandbox root directory (optional, default: `./sandbox`)

### Command-Specific Options

**`init-state`**:
- `--execution-mode <mode>` - `AUTO` or `MANUAL` (required)

**`set-goal`**:
- `--description <text>` - Goal description (required)
- `--project-id <id>` - Project identifier (optional)

**`enqueue`**:
- `--task-file <path>` - Path to task JSON file (required)

**`halt`**:
- `--reason <text>` - Halt reason (optional)

## Common Operations

### Check Foundry Status

**Using the status command** (recommended):
```bash
npm run cli -- status \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

**Check performance metrics**:
```bash
npm run cli -- metrics \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

**Alternative: Using redis-cli**:
```bash
redis-cli -h localhost -p 6499 GET supervisor:state | jq '.supervisor'
```

### View Current Goal

```bash
redis-cli -h localhost -p 6499 GET supervisor:state | jq '.goal'
```

### List Completed Tasks

```bash
redis-cli -h localhost -p 6499 GET supervisor:state | jq '.completed_tasks'
```

### View Audit Logs

```bash
# All logs
cat sandbox/<project-id>/audit.log.jsonl

# Last 50 lines
tail -50 sandbox/<project-id>/audit.log.jsonl

# Follow logs
tail -f sandbox/<project-id>/audit.log.jsonl

# Filter by task
cat sandbox/<project-id>/audit.log.jsonl | jq 'select(.task_id == "task-001")'
```

### View Verbose Application Logs

Foundry provides detailed verbose logging for debugging and monitoring:

```bash
# View PM2 logs (recommended)
pm2 logs supervisor --lines 100

# Follow logs in real-time
pm2 logs supervisor --follow

# View from log files
tail -f logs/supervisor-out.log
tail -f logs/supervisor-error.log

# Filter for specific log types
pm2 logs supervisor --lines 200 | grep "\[VERBOSE\]"
pm2 logs supervisor --lines 200 | grep "\[PERFORMANCE\]"
pm2 logs supervisor --lines 200 | grep "\[STATE_TRANSITION\]"
```

**Log Types**:
- **`[VERBOSE]`** - Detailed application logic, state information, and decision points
- **`[PERFORMANCE]`** - Operation timing metrics (duration in milliseconds)
- **`[STATE_TRANSITION]`** - State changes and transitions (e.g., `RUNNING → HALTED`)
- **Standard logs** - Iteration numbers, task IDs, validation results, etc.

**Example verbose log output**:
```
[2025-12-28T15:48:06.123Z] [VERBOSE] [ControlLoop] Starting iteration 1
[2025-12-28T15:48:06.125Z] [PERFORMANCE] StateLoad took 15ms | Metadata: {"iteration":1}
[2025-12-28T15:48:06.130Z] [VERBOSE] [ControlLoop] State loaded successfully | Data: {"iteration":1,"status":"RUNNING"}
[2025-12-28T15:48:06.135Z] [STATE_TRANSITION] CHECKING → RUNNING | Context: {"iteration":1}
[2025-12-28T15:48:06.140Z] [PERFORMANCE] TaskRetrieval took 5ms | Metadata: {"iteration":1,"source":"queue","has_task":true}
```

### Clear State

**Warning**: This deletes all state. Use with caution.

```bash
redis-cli -h localhost -p 6499 DEL supervisor:state
```

### State Management

To dump the current state to a JSON file (for debugging or backup):

```bash
npm run tsx scripts/dump-state.ts -- \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --output STATE.json
```

To load state from a JSON file (overwriting Redis state):

```bash
npm run tsx scripts/load-state.ts -- \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --input STATE.json
```

### Reset Queue

```bash
# Connect to queue database
redis-cli -h localhost -p 6499 -n 2

# List queue keys
KEYS *

# Clear queue (if needed)
FLUSHDB
```

## Troubleshooting

### Diagnostics & Investigation Tools

For troubleshooting system issues, use the [Investigation Scripts](./scripts/investigations/README.md) toolkit—a set of reusable diagnostic tools for inspecting provider health, task queue state, and execution logs.

**Quick Diagnostics**:
```bash
# Check provider status and circuit breakers
npx ts-node scripts/investigations/provider-health.ts

# Inspect task queue and blocked tasks
npx ts-node scripts/investigations/task-queue-inspect.ts

# Analyze execution logs and error patterns
npx ts-node scripts/investigations/log-analyzer.ts --summary
```

For detailed usage, examples, and a troubleshooting matrix, see [Investigation Scripts README](./scripts/investigations/README.md).

### DragonflyDB Not Starting

```bash
# Check logs
docker-compose logs dragonflydb

# Check if port is in use
lsof -i :6499

# Restart container
docker-compose restart dragonflydb
```

### Cursor CLI Not Found

```bash
# Check if cursor is in PATH
which cursor

# Set explicit path
export CURSOR_CLI_PATH=/path/to/cursor

# Verify it works
cursor --version
```

### State Key Already Exists

If you see "State key already exists" error:

```bash
# Option 1: Use different key
npm run cli -- init-state --state-key supervisor:state:new ...

# Option 2: Delete existing state (WARNING: loses all data)
redis-cli -h localhost -p 6499 DEL supervisor:state
```

### Foundry Retry Behavior

Foundry now automatically retries tasks on validation failures or ambiguity:

1. **Validation Failures**: If a task fails validation, Foundry:
   - Generates a fix prompt with validation feedback
   - Retries the task (up to `max_retries` from `retry_policy`, default: 3)
   - Only blocks the task if max retries exceeded (Foundry continues to next task)

2. **Ambiguity/Questions**: If ambiguity or questions are detected:
   - Foundry validates the output first (may be a false positive)
   - If validation passes but ambiguity detected, generates clarification prompt
   - Retries with instructions to avoid ambiguous language
   - Only halts on critical failures (execution errors, blocked status)

3. **Task Blocking**: After max retries, tasks are marked as blocked:
   ```bash
   redis-cli -h localhost -p 6499 GET supervisor:state | jq '.blocked_tasks'
   ```

4. **Critical Halts**: Foundry only halts immediately on:
   - `CURSOR_EXEC_FAILURE`: Cursor CLI execution failed
   - `BLOCKED`: Cursor explicitly reported blocked status
   - `OUTPUT_FORMAT_INVALID`: Output format doesn't match expected schema

### Task Validation Failed

1. **Check validation report**:
   ```bash
   redis-cli -h localhost -p 6499 GET supervisor:state | jq '.last_validation_report'
   ```

2. **Review failed rules**:
   ```bash
   redis-cli -h localhost -p 6499 GET supervisor:state | jq '.last_validation_report.rules_failed'
   ```

3. **Check retry count**:
   ```bash
   redis-cli -h localhost -p 6499 GET supervisor:state | jq '.supervisor | to_entries | map(select(.key | startswith("retry_count_")))'
   ```

4. **Foundry will automatically retry** - no manual intervention needed unless max retries exceeded

### Queue Exhausted but Goal Incomplete

If queue is exhausted but goal is not complete:

1. **Check queue status**:
   ```bash
   redis-cli -h localhost -p 6499 GET supervisor:state | jq '.queue'
   ```

2. **Enqueue additional tasks**:
   ```bash
npm run cli -- enqueue --task-file task-next.json ...
```

3. **Resume Foundry**:
   ```bash
npm run cli -- resume ...
```

### Sandbox Directory Issues

If tasks fail due to sandbox path issues:

1. **Check sandbox root**:
   ```bash
   redis-cli -h localhost -p 6499 GET supervisor:state | jq '.goal.project_id'
   ```

2. **Verify directory exists**:
   ```bash
   ls -la sandbox/<project-id>/
   ```

3. **Check permissions**:
   ```bash
   chmod -R 755 sandbox/
   ```

## Sandbox Structure

```
supervisor/
├── sandbox/              # Sandbox root (default: ./sandbox)
│   ├── project-1/        # Project-specific directory
│   │   ├── audit.log.jsonl
│   │   ├── logs/
│   │   │   └── prompts.log.jsonl
│   │   ├── src/          # Your boilerplate/initial code
│   │   ├── package.json   # Dependencies, scripts
│   │   ├── tsconfig.json # Configuration files
│   │   └── ...           # All project files
│   └── project-2/
│       └── ...
```

**Key Points**:
- Place your **code boilerplates** in `sandbox/<project-id>/` before starting
- Foundry will **work with and build upon** existing files
- All project files, logs, and artifacts are contained within the project directory
- Tasks execute in this directory context, so they can reference existing files

## Programmatic Usage

Foundry can be used programmatically by importing from the main entry point:

```typescript
import {
  controlLoop,
  loadState,
  persistState,
  enqueueTask,
  createQueue,
  buildPrompt,
  dispatchToCursor,
  validateTaskOutput,
  checkHardHalts,
  appendAuditLog,
  type SupervisorState,
  type Task,
} from './index';
```

### Example: Custom Control Loop

```typescript
import Redis from 'ioredis';
import { controlLoop, createQueue, loadState } from './index';

const redis = new Redis({ host: 'localhost', port: 6499, db: 0 });
const queue = createQueue('tasks', { host: 'localhost', port: 6499 }, 2);

// Run control loop
await controlLoop(
  persistence,
  queue,
  promptBuilder,
  cursorCLI,
  validator,
  auditLogger,
  './sandbox'
);
```

### Example: Enqueue Task Programmatically

```typescript
import { enqueueTask, createQueue } from './index';
import type { Task } from './index';

const queue = createQueue('tasks', { host: 'localhost', port: 6499 }, 2);

const task: Task = {
  task_id: 'task-001',
  intent: 'Create API endpoint',
  tool: 'cursor',
  instructions: 'Create Express.js endpoint...', 
  acceptance_criteria: ['Server starts', 'Endpoint responds'],
  retry_policy: { max_retries: 3 },
  status: 'pending',
  working_directory: 'my-backend-api', // Optional: overrides project_id default
};

await enqueueTask(queue, task);
await queue.close();
```

See [src/index.ts](src/index.ts) for all exported APIs.

## Key Principles

1. **Deterministic**: No planning, no task invention
2. **Operator Authority**: Operator is sole authority for goals, scope, constraints
3. **Explicit**: All tasks require explicit acceptance criteria
4. **Validation**: No task runs without validation
5. **State Persistence**: State persisted after every step
6. **Retry on Failures**: Validation failures and ambiguity trigger automatic retries (up to max retries)
7. **Optimized**: Skips redundant validation via Redis-based caching
8. **Measurable**: Detailed performance analytics for every task
9. **AUTO MODE**: Default and mandatory execution mode

See [.cursor/rules/supervisor-specs.mdc](.cursor/rules/supervisor-specs.mdc) for complete specifications.

## License

[Add license information]


## Local Helper Agent (Optional)

You can configure Foundry to use a local LLM (via Ollama) for helper agent tasks (command generation), reducing latency and cloud costs.

### Prerequisites
- [Ollama](https://ollama.com/) installed and running
- Model pulled (e.g., `ollama pull phi4-mini`)

### Configuration

Add to `.env`:
```bash
USE_LOCAL_HELPER_AGENT=true
LOCAL_HELPER_MODEL=phi4-mini
OLLAMA_BASE_URL=http://localhost:11434
```

### Benefits
- **Latency**: ~3-5s (vs 15-30s cloud)
- **Cost**: Free (no API tokens for validation command generation)
- **Privacy**: Validation logic runs locally

```