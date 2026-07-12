# Operator Takeover — Plan Index

Interactive chat-based operator control from the UI. Operator presses "Take Over" on a running task → task is killed immediately → operator provides instructions/guidance via chat.

## Sub-Plans

| # | File | Scope |
|---|------|-------|
| 1 | [01-overview.md](./01-overview.md) | Concept, UX flow, state model, scope (single-loop focus) |
| 2 | [02-backend.md](./02-backend.md) | WebSocket server, Redis PubSub relay, task kill + chat handoff |
| 3 | [03-frontend.md](./03-frontend.md) | Takeover panel, chat UI, action buttons |
| 4 | [04-implementation.md](./04-implementation.md) | Steps, dependencies, risks |

## Key Differences from Original Plan

- **Immediate kill** (not graceful suspend) — simplifies process management
- **No SIGTSTP/SIGCONT** — just `SIGTERM` to child process
- **Single-control-loop focus** — parallel scheduler support deferred (complex UX for worker selection)
- **Task execution context preserved** — operator chat has access to execution logs and task metadata
