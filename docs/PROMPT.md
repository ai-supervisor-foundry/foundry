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

