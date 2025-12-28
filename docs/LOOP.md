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

