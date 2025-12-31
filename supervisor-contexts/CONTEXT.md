# Supervisor System - Complete Context

## Overview

The Supervisor is a **persistent orchestration layer for AI-assisted software development** that enables long-running, restart-safe project execution with full operator control and auditability. It is a control plane that externalizes memory, intent, and control so work can continue across interruptions, sleep, crashes, or session loss.

### Software Factory Concept

The Supervisor operates like a **software factory** or **Replit-like environment** where you provide:

1. **Code Boilerplates**: Initial project structure, existing codebase, or starter templates
2. **Tasks**: Explicit task definitions with acceptance criteria (what needs to be built)
3. **Goal**: High-level project objective (what the project should achieve)

The Supervisor then **autonomously works on the project** by:
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
Supervisor autonomously:
  ├─ Executes tasks in order
  ├─ Works with existing code
  ├─ Validates outputs
  ├─ Persists state
  └─ Continues until goal met or halted
```

### Core Purpose

The Supervisor provides:
- **Persistence**: State survives crashes, restarts, and interruptions
- **Deterministic Control**: No surprises—explicit validation, clear halt conditions
- **Long-Running Projects**: Work on complex projects over days or weeks
- **Full Auditability**: Every action is logged and reviewable
- **Cost-Effective**: Uses free tier tools (Cursor CLI, DragonflyDB)
- **Autonomous Execution**: Works on projects without constant operator intervention

### The Problem It Solves

AI tools like Cursor are powerful but ephemeral—context is lost on interruption, making long-running projects difficult. The Supervisor bridges this gap by maintaining persistent state and deterministic execution. It enables a **"set it and forget it"** workflow where you provide boilerplates, tasks, and a goal, then the supervisor autonomously builds the project.

## Core Principles

### Supervisor Specifications

- The supervisor does **not** define goals. Operator must inject goals.
- Scope **cannot** be expanded by AI.
- All tasks require explicit acceptance criteria.
- No task runs without validation.
- No refactoring without explicit instruction.
- State must be persisted after every step.
- Ambiguity halts execution (with retry mechanism).
- Cursor CLI is a worker tool, not decision authority.
- **AUTO MODE is default and mandatory.**
- AUTO MODE cannot be disabled without operator instruction.
- No silent retries.
- All outputs are reviewable (diffs, logs).

### Anti-Goals (Do NOT Implement)

- Autonomous goal refinement
- Speculative task creation
- Retry heuristics (beyond explicit retry_policy)
- AI-based validation
- "Helpful" corrections
- Fallback behaviors

**If tempted → HALT.**

## Architecture

### Role Separation

The system is organized into distinct modules with clear responsibilities:

#### Operator Interface (`src/cli.ts`)
- Injects initial goal
- Injects tasks
- Issues HALT / RESUME commands
- Manages supervisor lifecycle

#### Supervisor Core (`src/controlLoop.ts`)
- Owns control loop
- Owns state read/write
- Owns validation orchestration
- Manages task lifecycle

#### Tool Dispatcher (`src/cursorCLI.ts`, `src/promptBuilder.ts`, `src/cliAdapter.ts`)
- Constructs Cursor task prompts
- Injects state snapshots
- Manages CLI provider selection (Cursor, Gemini, OpenRouter, Claude, Codex)
- Handles circuit breaker and fallback logic

#### Persistence Layer (`src/persistence.ts`)
- DragonflyDB read/write only
- State serialization/deserialization
- Atomic state updates

#### Queue Adapter (`src/queue.ts`)
- Redis List-based queue (LPUSH/RPOP)
- FIFO task ordering
- Queue state management

#### Validator (`src/validator.ts`)
- Deterministic, rule-based validation
- File existence checks
- Content pattern matching
- Test execution
- Keyword-based criterion matching

#### Audit Logger (`src/auditLogger.ts`)
- Append-only JSONL logging
- State diffs
- Event tracking
- Task lifecycle events

#### Logger (`src/logger.ts`)
- Centralized verbose logging
- PM2-compatible stdout flushing
- Performance metrics
- State transition tracking

**No module may cross responsibilities.**

## Control Loop

The supervisor executes a fixed control loop sequence:

1. **Load persisted state** from DragonflyDB
2. **Read injected operator goal** from state
3. **Select next operator-defined task** from queue (FIFO)
4. **Dispatch task to tool** via CLI adapter (injecting required state context into task prompt)
5. **Await completion** (Cursor CLI execution)
6. **Validate output** (deterministic, rule-based)
7. **Persist updated state** immediately after mutation
8. **Halt or continue** per explicit instruction

### Task List Rules

- Task list is treated as **closed and authoritative**
- The supervisor may only: select next task, dispatch, validate, persist
- **Do not implement** planning, decomposition, or task generation
- If the task list is exhausted and the goal is incomplete → ask agent if goal is met, then HALT if incomplete

## State Management

### State Lifecycle

- State is **initialized by the operator**
- State is **loaded at the start of every control loop iteration**
- State is **read-only during task execution**
- State is **mutated only after validation**
- State is **persisted immediately after mutation**
- State persistence failure **halts execution**
- Tools (including Cursor CLI) **do not access state directly**. The supervisor injects the required state context into each task prompt.

### State Schema

The supervisor state is stored as a single JSON blob in DragonflyDB with the following structure:

```json
{
  "goal": {
    "description": "string",
    "completed": boolean,
    "project_id": "string"
  },
  "supervisor": {
    "status": "RUNNING" | "HALTED" | "COMPLETED" | "BLOCKED",
    "iteration": number,
    "halt_reason": "string" | undefined,
    "halt_details": "string" | undefined
  },
  "current_task": {
    "task_id": "string",
    "attempt": number,
    "started_at": "ISO8601",
    "last_attempt_at": "ISO8601"
  } | null,
  "completed_tasks": Array<{
    "task_id": "string",
    "completed_at": "ISO8601",
    "validation_report": ValidationReport
  }>,
  "blocked_tasks": Array<{
    "task_id": "string",
    "reason": "string",
    "blocked_at": "ISO8601"
  }>,
  "queue": {
    "name": "string",
    "exhausted": boolean
  },
  "last_validation_report": ValidationReport | null,
  "last_updated": "ISO8601",
  "execution_mode": "AUTO" | "MANUAL",
  "resource_exhausted_retry": {
    "attempt": number,
    "last_attempt_at": "ISO8601",
    "next_retry_at": "ISO8601",
    "provider": "string"
  } | null
}
```

### State Access Rules

- State key is operator-defined (e.g., `supervisor:state`)
- State is stored in DragonflyDB database index 0 (default)
- Queue is stored in separate database index (e.g., 2)
- State is atomic—read entire blob, mutate, write entire blob

### Supervisor States

Explicit states:
- `RUNNING`: Actively processing tasks
- `HALTED`: Stopped (operator intervention, critical failure, ambiguity)
- `COMPLETED`: Goal achieved, queue exhausted
- `BLOCKED`: Cannot proceed (requires operator input)

State rules:
- HALT always persists state first
- BLOCKED requires operator input to resume
- No automatic resume after ambiguity
- Operator input is the only unblock mechanism

## Task Schema

Tasks are defined as JSON objects with the following structure:

```json
{
  "task_id": "string (unique identifier)",
  "intent": "string (brief description)",
  "tool": "cursor-cli (only supported tool)",
  "instructions": "string (detailed instructions for agent)",
  "acceptance_criteria": ["array of strings (ALL must be met)"],
  "retry_policy": {
    "max_retries": number (default: 3),
    "backoff_strategy": "linear" | "exponential"
  },
  "status": "pending" | "in_progress" | "completed" | "blocked",
  "working_directory": "string (optional, relative to sandboxRoot)",
  "agent_mode": "string (optional, e.g., 'opus-4.5', 'auto')",
  "required_artifacts": ["array of file paths (optional)"],
  "test_command": "string (optional)",
  "tests_required": boolean (optional)
}
```

### Task Lifecycle

1. **Pending**: Task is in queue, not yet started
2. **In Progress**: Task is currently being executed
3. **Completed**: Task passed validation, marked complete
4. **Blocked**: Task failed validation after max retries, requires operator intervention

## Queue System

### Implementation

- Task queue uses **Redis Lists** (LPUSH/RPOP)
- Queue runs on top of DragonflyDB (numbered database instance, e.g., db 2)
- **No Lua scripts required** (compatible with DragonflyDB constraints)
- Tasks are queued from operator instructions
- Supervisor control loop consumes tasks from queue (**FIFO order**)
- Queue key format: `queue:${queueName}`

### Queue Operations

- **Enqueue**: `LPUSH queue:tasks <task_json>` (adds to left/head of list)
- **Dequeue**: `RPOP queue:tasks` (removes from right/tail of list)
- **Peek**: `LRANGE queue:tasks 0 -1` (read-only, no mutation)

### Task Processing Order

Tasks are processed in **strict FIFO (First In, First Out) order**:
- Tasks enqueued first are processed first
- Uses Redis List with LPUSH (left push) for enqueue and RPOP (right pop) for dequeue
- This ensures the first task added to the queue is the first task processed
- **Exception**: If a task fails and is stored in `retry_task` state, it takes priority over the queue and will be retried before processing the next queued task

## Validation

### Validation Rules

- Validation logic must be **deterministic, rule-based, and non-AI**
- Examples: file exists, tests pass, diff matches criteria, artifact count matches expectation
- If validation cannot be automated → HALT + operator clarification

### Validation Process

1.  **Helper Agent Phase (V2)** (optional):
    -   If validation fails, supervisor uses a separate agent instance to generate read-only validation commands.
    -   **Code Discovery**: The Helper Agent is provided with a list of actual filenames from the codebase to prevent hallucinations.
    -   **Proactive**: Automatically triggered on validation failure.
    -   Commands are executed to verify criteria.
    -   If commands pass, interrogation is skipped, and task is marked complete.

2.  **Validation Scoring**:
    -   Calculates `MatchQuality` for each criterion: `EXACT` (strongest), `HIGH`, `MEDIUM`, `LOW`, `NONE`.
    -   Overall `confidence` is derived from the lowest quality match.
    -   If `confidence` is `UNCERTAIN` or `LOW` (with weak matches), interrogation is triggered even if technically "passed" by regex.

3.  **Targeted Interrogation Phase** (if Helper Agent fails or confidence is low):
    -   **Pre-Analysis**: Before asking, the system scans the codebase for keywords related to the failed criteria.
    -   **Targeted Prompts**: The interrogation prompt includes these potential file locations ("We found X, is this it?").
    -   Supervisor engages in sequential Q&A with the agent (max 4 rounds).
    -   Batches all unresolved criteria into a single prompt per round.

4.  **Validation Result**:
    -   Returns `confidence: 'HIGH' | 'LOW' | 'UNCERTAIN'`.
    -   Returns `failed_criteria` and `uncertain_criteria`.
    -   If `HIGH` confidence → task marked complete.
    -   If `LOW` or `UNCERTAIN` → retry with fix prompt.
    -   **Smart Retry**: If the agent fails with the exact same error twice, the retry prompt switches to "Strict Mode" to force a different approach.

### Prompt Construction

The supervisor uses **Smart Context Injection** to minimize token usage and focus the agent:

-   **Base Context**: Project ID and Sandbox Root (always included).
-   **Goal Context**: Included only if task intent relates to "goal".
-   **Queue Context**: Included only if task references "previous" or "last" task.
-   **Completed Tasks**: Included only if task is "extending" or "building on" work.

**Task-Type Guidelines**:
Prompts automatically include specific guidelines based on detected task type:
-   **Implementation**: Focus on code structure and patterns.
-   **Configuration**: Verify file locations and env vars.
-   **Testing**: Focus on edge cases and assertions.
-   **Documentation**: Ensure formatting and links.
-   **Refactoring**: Preserve functionality.

### Validation Checklist

- [ ] Was output generated for the specified task?
- [ ] Does output meet all acceptance criteria?
- [ ] Are test outputs present (if `tests_required: true`)?
- [ ] Are required artifacts present?
- [ ] Is state updated appropriately?

## Tool Contracts

### Cursor CLI Integration

The supervisor uses Cursor CLI to dispatch tasks. Cursor CLI is treated as a **worker tool**, not a decision authority.

#### Allowed Actions
- Execute tasks as specified
- Receive state context injected by supervisor in task prompt
- Produce artifacts per instructions

#### Forbidden Actions
- Cursor CLI must **not** redefine tasks
- Cursor CLI must **not** expand scope
- Cursor CLI must **not** exit AUTO MODE
- Cursor cannot enqueue tasks
- Cursor cannot reorder tasks
- Cursor cannot approve itself
- Cursor cannot mutate state

#### Required Outputs
- Task completion status
- Validation results
- Artifacts produced

#### Failure Conditions
- Cursor CLI must halt if information is missing

### CLI Adapter

The supervisor uses a CLI adapter (`src/cliAdapter.ts`) that provides:
- **Priority-based provider selection**: Gemini → Cursor → Codex → Claude (default order, configurable via `CLI_PROVIDER_PRIORITY` env var)
- **Circuit breaker**: 1-day TTL for failed providers
- **Automatic fallback**: On resource exhaustion or provider failure
- **Model filtering**: Only allowed models (sonnet*, opus*, gpt4*, gpt5*, gemini*)

### Cursor Prompt Construction

Every task dispatched to Cursor must include:
- Task ID
- Task description (verbatim from operator)
- Acceptance criteria (verbatim)
- Injected state snapshot (explicit section)
- Explicit instruction to remain in AUTO MODE
- Explicit instruction to halt on ambiguity
- Explicit output format requirement
- **WORKING DIRECTORY** instruction
- **AGENT MODE** instruction (if specified)

The Cursor agent must **never infer missing information**.

## Sandbox Enforcement

### Multi-Project Rules

Each app/project:
- Has its own directory
- Has its own state key
- Has its own task queue

### Supervisor Enforcement

- **No cross-project file access**
- **No shared state**
- Cursor task prompts must specify: `WORKING DIRECTORY: <sandbox-root>/<project-id>` or `<sandbox-root>/<working_directory>`

### Sandbox Location

- Default sandbox root: `./sandbox` (relative to supervisor project root)
- Project directory: `<sandbox-root>/<project-id>`
- Task-level override: `<sandbox-root>/<working_directory>` (if specified in task)
- Example: `./sandbox/api-project` or `/sandbox/api-project` (if absolute path provided)

### Working with Existing Code

The supervisor is designed to **work with existing codebases and boilerplates**:

- **Boilerplates**: Place starter code in `sandbox/<project-id>/` before starting
- **Existing Projects**: Point supervisor to existing project directories
- **Incremental Development**: Tasks can extend, modify, or build upon existing files
- **Code Context**: The supervisor's agent (Cursor CLI) has full access to all files in the sandbox directory
- **File References**: Tasks can explicitly reference existing files in instructions

**Example Task Instructions**:
```
"Extend the existing App.tsx component to add user authentication. 
The component is located at src/App.tsx and uses React Router. 
Follow the existing code style and patterns."
```

### Violations

- Any violation → task invalid

## Ambiguity Handling

### Hard Rule: HALT Conditions

If any of the following occur, the supervisor must handle appropriately:

- Cursor output asks a question → Generate clarification prompt, retry (up to max_retries)
- Cursor output proposes alternatives → Generate clarification prompt, retry
- Acceptance criteria are partially met → Helper Agent → Interrogation → Retry
- Output format deviates → HALT immediately
- Required artifact is missing → Helper Agent → Interrogation → Retry

### Retry Mechanism

- Validation failures trigger automatic retries (up to `max_retries` from `retry_policy`)
- Ambiguity/questions trigger clarification prompts and retries
- After max retries exceeded → task marked `BLOCKED`
- Supervisor continues to next task (does not halt on single task failure)

### Critical Halts

Supervisor only halts immediately on:
- `CURSOR_EXEC_FAILURE`: Cursor CLI execution failed
- `BLOCKED`: Cursor explicitly reported blocked status
- `OUTPUT_FORMAT_INVALID`: Output format doesn't match expected schema
- `RESOURCE_EXHAUSTED`: Provider resource exhaustion (with backoff strategy)

## Recovery Actions

- **Cursor CLI crash** → Reload rules & state, reissue last task
- **Supervisor restart** → Load last saved state, resume from next task
- **Partial task** → Flag blocked, operator input required
- **Conflicting state** → Halt and request resolution
- **State persistence failure** → Halt immediately

## Logging & Auditability

### Required Logs

Supervisor must log:
- Task dispatched
- Tool invoked
- Validation result
- State diff (before/after)
- Halt reason (if any)
- Interrogation rounds
- Helper Agent commands
- Goal completion checks

### Log Rules

- Logs must be **append-only and reviewable**
- Audit logs: JSONL format in `sandbox/<project-id>/audit.log.jsonl`
- Prompt logs: JSONL format in `sandbox/<project-id>/logs/prompts.log.jsonl`
- Verbose logs: PM2 stdout/stderr (captured in `logs/supervisor-out.log` and `logs/supervisor-error.log`)

### Log Types

- **Audit Logs**: High-level events, state transitions, validation results
- **Prompt Logs**: Full prompts and responses sent to/received from agents
- **Verbose Logs**: Detailed application logic, performance metrics, state transitions

## DragonflyDB Constraints

- DragonflyDB is **single-node only**
- Default configuration is used
- No performance tuning
- No eviction policy changes
- No persistence mode changes without operator instruction
- Availability is assumed local-only
- **No Lua scripts** (use Redis List operations only)
- **No pub/sub** (not supported)
- **No clustering** (single instance only)

## Resource Exhaustion Handling

When a CLI provider (e.g., Cursor) returns `ConnectError: [resource_exhausted]`:

1. **Backoff Strategy**:
   - 1 minute
   - 5 minutes
   - 20 minutes
   - 1 hour
   - 2 hours
   - Then complete halt

2. **State Tracking**:
   - Tracks attempt number, last attempt time, next retry time
   - Stores provider name in state
   - Supervisor sleeps during backoff (longer intervals to reduce CPU cycles)

3. **Circuit Breaker**:
   - Failed provider is circuit-broken for 1 day (TTL in DragonflyDB)
   - Automatic fallback to next provider in priority chain

## Goal Completion Check

When the queue is exhausted and the goal is not completed:

1. Supervisor builds a prompt asking the agent if the goal is met
2. Agent responds with JSON: `{ "goal_completed": boolean, "reasoning": "string" }`
3. If `goal_completed: true` → Supervisor marks goal as complete, status becomes `COMPLETED`
4. If `goal_completed: false` → Supervisor halts with agent's reasoning

## Installation & Setup

### Prerequisites

- **Node.js**: LTS version (install via [nvm](https://github.com/nvm-sh/nvm))
- **Docker & Docker Compose**: For running DragonflyDB
- **Cursor CLI**: Install `cursor` command (see [Cursor CLI docs](https://cursor.com/cli))
- **Optional**: Claude CLI, Gemini CLI, Codex CLI, OpenRouter API key

### Install Dependencies

```bash
npm install
npm run build
```

### Infrastructure Setup

1. **Start DragonflyDB**:
   ```bash
   docker-compose up -d
   ```

2. **Verify DragonflyDB is running**:
   ```bash
   docker ps | grep dragonflydb
   redis-cli -h localhost -p 6499 ping  # Should return: PONG
   ```

## Usage

### Software Factory Workflow

The typical workflow follows this pattern:

1. **Prepare Code Boilerplates** (optional but recommended)
2. **Initialize Supervisor State**
3. **Set Goal**
4. **Enqueue Tasks**
5. **Start Supervisor** (autonomous execution)

### 0. Prepare Code Boilerplates (Optional)

Before starting the supervisor, you can prepare initial code in the sandbox directory:

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

The supervisor will **work with and build upon** this existing code. Tasks can reference existing files, extend functionality, or create new features.

### 1. Initialize Supervisor State

```bash
npm run cli -- init-state \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --execution-mode AUTO
```

### 2. Set Goal

```bash
npm run cli -- set-goal \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --description "Your goal description here" \
  --project-id my-project
```

**Important**: The `--project-id` should match the directory name in `sandbox/` where your boilerplates are located.

### 3. Enqueue Tasks

```bash
npm run cli -- enqueue \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --task-file tasks/tasks.json
```

Tasks can reference existing files from your boilerplates. For example:
- "Extend the existing `App.tsx` component to add..."
- "Add a new API endpoint following the pattern in `routes/users.ts`"
- "Update the existing database schema in `schema.sql`"

### 4. Start Supervisor

```bash
npm run cli -- start \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

### 5. Monitor Execution

```bash
# Check status
npm run cli -- status \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2

# View audit logs
tail -f sandbox/<project-id>/audit.log.jsonl

# View PM2 logs
pm2 logs supervisor --follow
```

### Halt/Resume

```bash
# Halt
npm run cli -- halt \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2 \
  --reason "Operator intervention"

# Resume
npm run cli -- resume \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
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

## Key Components

- **Operator Interface** (`src/cli.ts`): CLI commands for operator control
- **Supervisor Core** (`src/controlLoop.ts`): Main control loop
- **Tool Dispatcher** (`src/cursorCLI.ts`, `src/promptBuilder.ts`, `src/cliAdapter.ts`): CLI integration
- **Persistence Layer** (`src/persistence.ts`): DragonflyDB state management
- **Queue Adapter** (`src/queue.ts`): Redis List-based task queue
- **Validator** (`src/validator.ts`): Deterministic validation
- **Interrogator** (`src/interrogator.ts`): Sequential Q&A for validation clarification
- **Command Generator** (`src/commandGenerator.ts`): Helper Agent for validation commands
- **Audit Logger** (`src/auditLogger.ts`): Append-only logging
- **Prompt Logger** (`src/promptLogger.ts`): Detailed prompt/response logging
- **Logger** (`src/logger.ts`): Centralized verbose logging

## Configuration

### Environment Variables

```bash
export CURSOR_CLI_PATH=/path/to/cursor  # Optional, defaults to 'cursor'
export OPENROUTER_API_KEY=your_key      # For OpenRouter integration
```

### CLI Global Options

All commands require:
- `--redis-host <host>` - DragonflyDB host (default: `localhost`)
- `--redis-port <port>` - DragonflyDB port (default: `6499`)
- `--state-key <key>` - Supervisor state key (e.g., `supervisor:state`)
- `--queue-name <name>` - Task queue name (e.g., `tasks`)
- `--queue-db <index>` - Queue database index (must differ from state DB, e.g., `2`)
- `--state-db <index>` - State database index (optional, default: `0`)
- `--sandbox-root <path>` - Sandbox root directory (optional, default: `./sandbox`)

## PM2 Integration

The supervisor can be run as a daemon using PM2:

```bash
# Start supervisor with PM2
pm2 start npm --name supervisor -- run cli -- start --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2

# View logs
pm2 logs supervisor --follow

# Stop supervisor
pm2 stop supervisor

# Restart supervisor
pm2 restart supervisor
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
- The supervisor will **work with and build upon** existing files
- All project files, logs, and artifacts are contained within the project directory
- Tasks execute in this directory context, so they can reference existing files

## Final Instruction

If any implementation decision is not explicitly specified above or in the refresher, **STOP and ask for operator clarification. Do not assume.**

