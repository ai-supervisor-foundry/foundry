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
  "goals": {
    "<project_id>": {
      "description": "string",
      "completed": boolean,
      "project_id": "string (same as key, for self-reference)"
    }
  },
  "supervisor": {
    "status": "RUNNING" | "HALTED" | "COMPLETED" | "BLOCKED",
    "iteration": number,
    "halt_reason": "string" | undefined,
    "halt_details": "string" | undefined
  },
  "active_tasks": {
    "<task_id>": {
      "task": Task,
      "worker_id": "string",
      "started_at": "ISO8601",
      "worktree_path": "string" | undefined
    }
  },
  "worker_pool": {
    "max_workers": number,
    "active_count": number
  } | undefined,
  "file_locks": {
    "<file_path>": {
      "file_path": "string",
      "task_id": "string",
      "worker_id": "string",
      "acquired_at": "ISO8601"
    }
  } | undefined,
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
    "exhausted": boolean,
    "ready_count": number | undefined,
    "waiting_count": number | undefined
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

## Per-Project Goals

- `state.goals` is a `Record<string, Goal>` keyed by `project_id`.
- Each task carries a required `project_id` field that determines its CWD (`sandbox/{project_id}/`) and which goal it belongs to.
- Supervisor reaches `COMPLETED` only when all project goals are completed.
- Old state with a single `goal:` field is auto-migrated to `goals:` on load.
- Set goals with: `npm run cli -- set-goal --project-id <id> --description "<text>"` (project-id is required).

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
