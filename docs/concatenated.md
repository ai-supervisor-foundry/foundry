# Supervisor Directives

- The supervisor executes only operator-provided goals.
- The supervisor uses persistent state and a fixed control loop.
- Tasks are dispatched to tools explicitly via Cursor CLI.
- Cursor CLI is treated as a worker in AUTO MODE.
- Halt and request clarification on ambiguities.

## Supervisor Nature

- Implement the supervisor as a deterministic control process, not an AI.
- The supervisor must contain no LLM calls internally.
- Any AI usage must be explicitly externalized as a tool invocation (Cursor CLI).
- If any logic requires "judgment", the supervisor must halt and request operator input.


---

# Control Loop

1. Load persisted state.
2. Read injected operator goal from state (built from initial operator instructions).
3. Select the next operator-defined task from queue (built from operator instructions).
4. Dispatch task to specified tool via Cursor CLI (injecting required state context into task prompt).
5. Await completion.
6. Validate output.
7. Persist updated state.
8. Halt or continue per explicit instruction.

## Task List Rules

- Task list is treated as closed and authoritative.
- The supervisor may only: select next task, dispatch, validate, persist.
- Do not implement planning, decomposition, or task generation.
- If the task list is exhausted and the goal is incomplete → HALT.


---

# Schema Context

- The supervisor state schema is:
  - NOT a database schema
  - NOT an application domain model
  - NOT a runtime memory of Cursor
  - NOT a relational schema

- It IS:
  - a persisted CONTROL STATE
  - owned by the supervisor
  - written and read explicitly by the control loop
  - serializable as JSON
  - serialized as JSON and stored as a single Redis-compatible value
  - also usable as a flat JSON file on disk

- It represents:
  - the current supervisory control state
  - NOT business data
  - NOT user data
  - NOT app data


---

# State Lifecycle

- State is initialized by the operator.
- State is loaded at the start of every control loop iteration.
- State is read-only during task execution.
- State is mutated only after validation.
- State is persisted immediately after mutation.
- State persistence failure halts execution.
- Tools (including Cursor CLI) do not access state directly. The supervisor injects the required state context into each task prompt.


---

# State Storage

- The supervisor state store is DragonflyDB.
- DragonflyDB is used as a Redis-compatible key-value store.
- No Redis cluster features are used.
- No pub/sub is used.
- No streams are used.
- No Lua scripts are used.

Storage model:
- Single key holds the entire supervisor state.
- Value is serialized JSON.
- Reads and writes are explicit and synchronous.

DragonflyDB is infrastructure, not logic.


---

# DragonflyDB Constraints

- DragonflyDB is single-node only.
- Default configuration is used.
- No performance tuning.
- No eviction policy changes.
- No persistence mode changes without operator instruction.
- Availability is assumed local-only.


---

# State Key

- One key name is used for supervisor state.
- Key name is fixed and operator-defined.
- No secondary keys.
- No derived keys.
- Overwrites replace the full state using a single SET operation.


---

# State Access

- Supervisor loads state at loop start.
- State is immutable during task execution.
- Validation must complete before mutation.
- Only the supervisor writes state.
- Tools (including Cursor CLI) do not access state directly. The supervisor injects the required state context into each task prompt.
- State snapshots are injected into task prompts explicitly.

## State Snapshot Rules

- Inject only the minimal required subset of state.
- Never inject the full raw state unless explicitly required.
- Clearly label injected state as: `READ-ONLY CONTEXT — DO NOT MODIFY`
- Cursor output attempting to mutate state directly is invalid.


---

# State Setup

1. Operator starts DragonflyDB via docker-compose.
2. Operator initializes supervisor state key from chat prompt/instructions.
3. execution_mode is set to "AUTO".
4. goal is injected explicitly from operator instructions.
5. Supervisor loop may begin.

## No Hidden Defaults

- Avoid implicit defaults
- Fail fast on missing config
- Require explicit operator input for:
  - execution_mode
  - state key
  - sandbox root
  - queue name
- Silence is treated as misconfiguration


---

# Tool Contracts

## Allowed Actions
- Execute tasks as specified.
- Receive state context injected by supervisor in task prompt.
- Produce artifacts per instructions.

## Forbidden Actions
- Cursor CLI must not redefine tasks.
- Cursor CLI must not expand scope.
- Cursor CLI must not exit AUTO MODE.
- Cursor cannot enqueue tasks.
- Cursor cannot reorder tasks.
- Cursor cannot approve itself.
- Cursor cannot mutate state.

## Required Outputs
- Task completion status.
- Validation results.
- Artifacts produced.

## Failure Conditions
- Cursor CLI must halt if information is missing.

## Tool Implementation
- Supervisor uses Cursor CLI to dispatch tasks.
- Cursor outputs are untrusted input.
- Supervisor treats Cursor output like user-submitted code.

## Cursor Prompt Construction

Every task dispatched to Cursor must include:
- Task ID
- Task description (verbatim from operator)
- Acceptance criteria (verbatim)
- Injected state snapshot (explicit section)
- Explicit instruction to remain in AUTO MODE
- Explicit instruction to halt on ambiguity
- Explicit output format requirement

The Cursor agent must never infer missing information.

## Final Instruction

If any implementation decision is not explicitly specified above or in the refresher, STOP and ask for operator clarification. Do not assume.


---

# Validation Checklist

- [ ] Was output generated for the specified task?
- [ ] Does output meet all acceptance criteria?
- [ ] Are test outputs present?
- [ ] Is state updated appropriately?
- [ ] Any ambiguity halts and requires operator clarification.

## Validation Rules

- Validation logic must be deterministic, rule-based, and non-AI.
- Examples: file exists, tests pass, diff matches criteria, artifact count matches expectation.
- If validation cannot be automated → HALT + operator clarification.


---

# Recovery Actions

- Cursor CLI crash — reload rules & state, reissue last task.
- Supervisor restart — load last saved state, resume.
- Partial task — flag blocked, operator input required.
- Conflicting state — halt and request resolution.


---

# Runbook

- Start session (load PROMPT.md & rules).
- Inject explicit goal.
- Execute control loop (tasks dispatched via Cursor CLI).
- Review outputs/diffs.
- Persist state.
- Stop execution.


---

# Queue System

- Task queue is implemented using BullMQ.
- BullMQ runs on top of DragonflyDB (numbered database instance, e.g., db 2 or 3).
- Tasks are queued from operator instructions.
- Supervisor control loop consumes tasks from queue.
- Queue integration with supervisor state management.


---

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


---

# Ambiguity Handling

## Hard Rule: HALT Conditions

If any of the following occur, the supervisor must HALT:

- Cursor output asks a question
- Cursor output proposes alternatives
- Acceptance criteria are partially met
- Output format deviates
- Required artifact is missing

## Rules

- No retries unless operator explicitly instructs.
- Operator input is the only unblock mechanism.


---

# Supervisor States

## Explicit States

- `RUNNING`
- `BLOCKED`
- `HALTED`
- `COMPLETED`

## State Rules

- HALT always persists state first
- BLOCKED requires operator input to resume
- No automatic resume after ambiguity
- Operator input is the only unblock mechanism


---

# Sandbox Enforcement

## Multi-Project Rules

- Each app/project:
  - has its own directory
  - has its own state key
  - has its own task queue

## Supervisor Enforcement

- No cross-project file access
- No shared state
- Cursor task prompts must specify: `WORKING DIRECTORY: /sandbox/<project>`

## Violations

- Any violation → task invalid


---

# Logging & Auditability

## Required Logs

Supervisor must log:
- task dispatched
- tool invoked
- validation result
- state diff (before/after)
- halt reason (if any)

## Log Rules

- Logs must be append-only and reviewable.


---

---
alwaysApply: true
---

# Supervisor Specifications

- The supervisor does not define goals.
- Operator must inject goals.
- Scope cannot be expanded by AI.
- All tasks require explicit acceptance criteria.
- No task runs without validation.
- No refactoring without explicit instruction.
- State must be persisted after every step.
- Ambiguity halts execution.
- Cursor CLI is a worker tool, not decision authority.
- AUTO MODE is default and mandatory.
- AUTO MODE cannot be disabled without operator instruction.
- No silent retries.
- All outputs are reviewable (diffs, logs).

## Anti-Goals (Do NOT Implement)

- Autonomous goal refinement
- Speculative task creation
- Retry heuristics
- AI-based validation
- "Helpful" corrections
- Fallback behaviors

If tempted → HALT.

---

