# Task Schema

Tasks are defined as JSON objects with the following structure:

```json
{
  "task_id": "string (unique identifier)",
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

## Task Lifecycle

1. **Pending**: Task is in queue, not yet started
2. **In Progress**: Task is currently being executed
3. **Completed**: Task passed validation, marked complete
4. **Blocked**: Task failed validation after max retries, requires operator intervention
