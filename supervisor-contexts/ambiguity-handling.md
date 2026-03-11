# Ambiguity Handling

## Hard Rule: HALT Conditions

If any of the following occur, the supervisor must handle appropriately:

- Cursor output asks a question → Generate clarification prompt, retry (up to max_retries)
- Cursor output proposes alternatives → Generate clarification prompt, retry
- Acceptance criteria are partially met → Helper Agent → Interrogation → Retry
- Output format deviates → HALT immediately
- Required artifact is missing → Helper Agent → Interrogation → Retry

## Retry Mechanism

- Validation failures trigger automatic retries (up to `max_retries` from `retry_policy`)
- Ambiguity/questions trigger clarification prompts and retries
- After max retries exceeded → task marked `BLOCKED`
- Supervisor continues to next task (does not halt on single task failure)

## Critical Halts

Supervisor only halts immediately on:
- `CURSOR_EXEC_FAILURE`: Cursor CLI execution failed
- `BLOCKED`: Cursor explicitly reported blocked status
- `OUTPUT_FORMAT_INVALID`: Output format doesn't match expected schema
- `RESOURCE_EXHAUSTED`: Provider resource exhaustion (with backoff strategy)
