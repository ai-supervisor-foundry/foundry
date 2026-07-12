---
description: State lifecycle, JSON schema, per-project goals, and access rules
---

# State Management

## Lifecycle

- Initialized by operator, loaded every iteration, read-only during execution
- Mutated only after validation, persisted immediately after mutation
- Persistence failure → HALT. Providers never access state directly.

## Schema (DragonflyDB JSON blob)

```json
{
  "goals": { "<project_id>": { "description": "", "completed": false, "project_id": "" } },
  "supervisor": { "status": "RUNNING|HALTED|COMPLETED|BLOCKED", "iteration": 0 },
  "active_tasks": { "<task_id>": { "task": {}, "worker_id": "", "started_at": "", "worktree_path": "", "git_context": {}, "git_execution_seq": 0 } },
  "completed_tasks": [{ "task_id": "", "completed_at": "", "validation_report": {}, "intent": "", "instructions": "", "acceptance_criteria": [], "tool": "", "project_id": "", "affects_files": [], "depends_on": [], "working_directory": "", "agent_mode": "" }],
  "blocked_tasks": [{ "task_id": "", "reason": "", "blocked_at": "", "intent": "", "instructions": "", "acceptance_criteria": [], "tool": "", "project_id": "", "affects_files": [], "depends_on": [], "working_directory": "", "agent_mode": "" }],
  "queue": { "exhausted": false, "ready_count": 0, "waiting_count": 0 },
  "worker_pool": { "max_workers": 3, "active_count": 0 },
  "file_locks": { "<path>": { "file_path": "", "task_id": "", "worker_id": "", "acquired_at": "" } },
  "last_updated": "", "execution_mode": "AUTO"
}
```

## Per-Project Goals

- `state.goals` is an object (JSON) keyed by `project_id`. Each value is a Goal object.
- Each task carries a required `project_id` field that determines its working directory (`sandbox/{project_id}/`) and which goal it is associated with.
- Supervisor state becomes `COMPLETED` only when all goals for all projects in `state.goals` have been completed.
- Legacy state files with a top-level single `goal:` property are automatically migrated to `goals:` (per-project format) upon load.
- To set a new goal: `npm run cli -- set-goal --project-id <id> --description "<text>"` (must provide project-id).

Full annotated schema: [state-schema-detail.md](./state-schema-detail.md)

## Access Rules

- State key operator-defined. State DB index 0, queue DB separate (e.g., 2).
- Atomic: read entire blob → mutate → write entire blob.

## Supervisor States

- `RUNNING`: Processing tasks. `HALTED`: Operator/failure stop. `COMPLETED`: Goal met. `BLOCKED`: Needs input.
- HALT always persists first. BLOCKED requires operator input. No auto-resume after ambiguity.
