---
description: Fixed control loop sequence — dequeue, execute, validate, persist
---

# Control Loop

The supervisor executes a fixed control loop sequence:

1. **Load persisted state** from DragonflyDB
2. **Read injected operator goal** from state
3. **Select next operator-defined task** from queue (FIFO)
4. **Dispatch task to tool** via CLI adapter (injecting required state context into task prompt)
5. **Await completion** (Provider CLI execution)
6. **Validate output** (deterministic, rule-based)
7. **Persist updated state** immediately after mutation
8. **Halt or continue** per explicit instruction

## Task List Rules

- Task list is treated as **closed and authoritative**
- The supervisor may only: select next task, dispatch, validate, persist
- **Do not implement** planning, decomposition, or task generation
- If the task list is exhausted and the goal is incomplete → ask agent if goal is met, then HALT if incomplete
