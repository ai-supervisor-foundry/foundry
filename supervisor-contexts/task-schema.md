---
description: Task JSON structure — required fields, depends_on, affects_files
---

# Task Schema

Tasks are defined as JSON objects with the following structure:

```json
{
  "task_id": "string (unique identifier)",
  "project_id": "string (required — sandbox working directory)",
  "intent": "string (brief description)",
  "tool": "cursor | gemini | gemini_stub | copilot | codex | claude",
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

## Project Assignment

Each task must specify its `project_id`. This determines the agent's working directory as `sandbox/{project_id}/`. The `working_directory` field can still override this default if a task needs a different CWD.

## Task Lifecycle

1. **Pending**: Task is in queue, not yet started
2. **In Progress**: Task is currently being executed
3. **Completed**: Task passed validation, marked complete
4. **Blocked**: Task failed validation after max retries, requires operator intervention
