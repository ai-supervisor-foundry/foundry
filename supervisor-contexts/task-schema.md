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
  "tool": "cursor | gemini | gemini_stub | copilot | codex | claude | ollama (optional — acts as provider override; strategy decides if omitted)",
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
  "affects_files": ["array of file paths (required for parallel mode — file locking)"],
  "depends_on": ["array of task IDs (optional — execution order)"],
  "test_command": "string (optional)",
  "tests_required": boolean (optional)
}
```

## Project Assignment

Each task must specify its `project_id`. This determines the agent's working directory as `sandbox/{project_id}/`. The `working_directory` field is optional prompt-level context — if provided, its value is appended to the task prompt for additional path context but does **not** override the CWD (which is always derived from `project_id`).

## Parallel execution fields

For parallel or file-locked execution, each task must include:

- **`affects_files`** (required in parallel mode): Array of file paths this task will modify. Used for file-level locking so no two tasks edit the same file at once.
- **`depends_on`** (optional): Array of task IDs that must complete before this task can start.

See [usage.md](./usage.md) § Parallel Execution Fields for examples.

## Provider Override (`tool`)

When `task.tool` is set, it acts as a **provider override** — the CLI adapter routes directly to that provider, bypassing the strategy's priority chain. The `agent_mode` field is passed as the `--model` flag to the selected provider. When `tool` is omitted, the active strategy's priority chain selects the provider.

This override applies to all execution paths: initial execution, retry/fix attempts, and interrogation.

## Task Lifecycle

1. **Pending**: Task is in queue, not yet started
2. **In Progress**: Task is currently being executed
3. **Completed**: Task passed validation, marked complete
4. **Blocked**: Task failed validation after max retries, requires operator intervention
