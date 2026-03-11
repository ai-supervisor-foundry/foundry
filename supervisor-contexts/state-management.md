# State Management

## State Lifecycle

- State is **initialized by the operator**
- State is **loaded at the start of every control loop iteration**
- State is **read-only during task execution**
- State is **mutated only after validation**
- State is **persisted immediately after mutation**
- State persistence failure **halts execution**
- Provider CLIs **do not access state directly**. The supervisor injects the required state context into each task prompt.

## State Schema

The supervisor state is stored as a single JSON blob in DragonflyDB with the following structure:

```json
{
  "goal": {
    "description": "string",
    "completed": boolean,
    "project_id": "string (optional — goal-level default for tasks)"
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

## Project ID Resolution

- `goal.project_id` is optional and serves as a default for tasks that omit their own.
- Each task carries a required `project_id` field. Resolution order: `task.project_id || state.goal.project_id || 'default'`.

## State Access Rules

- State key is operator-defined (e.g., `supervisor:state`)
- State is stored in DragonflyDB database index 0 (default)
- Queue is stored in separate database index (e.g., 2)
- State is atomic—read entire blob, mutate, write entire blob

## Supervisor States

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
