---
description: Full annotated JSON schema for supervisor state blob in DragonflyDB
---

# State Schema — Full Detail

Parent: [state-management.md](./state-management.md)

```json
{
  "goals": {
    "<project_id>": { "description": "string", "completed": "boolean", "project_id": "string" }
  },
  "supervisor": {
    "status": "RUNNING | HALTED | COMPLETED | BLOCKED",
    "iteration": "number",
    "halt_reason": "string | undefined",
    "halt_details": "string | undefined"
  },
  "active_tasks": {
    "<task_id>": {
      "task": "Task",
      "worker_id": "string",
      "started_at": "ISO8601",
      "worktree_path": "string?",
      "git_context": "{ gitRoot, sandboxRel, changedPaths, resolvedAt }?",
      "git_context_key": "string?",
      "git_execution_seq": "number?"
    }
  },
  "worker_pool": { "max_workers": "number", "active_count": "number" },
  "file_locks": {
    "<file_path>": { "file_path": "string", "task_id": "string", "worker_id": "string", "acquired_at": "ISO8601" }
  },
  "completed_tasks": [{ "task_id": "", "completed_at": "ISO8601", "validation_report": {}, "intent": "", "instructions": "", "acceptance_criteria": [], "tool": "", "project_id": "", "affects_files": [], "depends_on": [], "working_directory": "", "agent_mode": "" }],
  "blocked_tasks": [{ "task_id": "", "reason": "", "blocked_at": "ISO8601", "intent": "", "instructions": "", "acceptance_criteria": [], "tool": "", "project_id": "", "affects_files": [], "depends_on": [], "working_directory": "", "agent_mode": "" }],
  "queue": { "name": "string", "exhausted": "boolean", "ready_count": "number?", "waiting_count": "number?" },
  "last_validation_report": "ValidationReport | null",
  "last_updated": "ISO8601",
  "execution_mode": "AUTO | MANUAL",
  "resource_exhausted_retry": {
    "attempt": "number", "last_attempt_at": "ISO8601", "next_retry_at": "ISO8601", "provider": "string"
  }
}
```
