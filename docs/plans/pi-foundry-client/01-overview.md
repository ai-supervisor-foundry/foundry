# 01 — Overview

## Name

**Foundry Cockpit** — a view inside the existing Foundry UI (`UI/frontend`), not a separate app.

## Topology

```text
Browser Cockpit  ──REST (poll + mutate)──┐
TUI (optional)   ──REST + SSE────────────┤
                                         ▼
                              UI backend (Express)
                         ┌─────────┴─────────┐
                         │                   │
                    Dragonfly state     Dragonfly PubSub
                    / queue (as today)   (event bus)
                         ▲                   ▲
                         │                   │
                    Control loop ────── publishes events
                         │
                      Workers
```

Clients **never** open Redis/Dragonfly. UI backend bridges PubSub → SSE.

## Prompt → task

| Step | Who | What |
|------|-----|------|
| 1 | Human | Prompt under goal/project |
| 2 | Ollama | Draft AC via `POST /api/tasks/draft-ac` |
| 3 | Human | Checkboxes + empty field (Enter adds) |
| 4 | Optional | Think better → primary model |
| 5 | Human | Confirm |
| 6 | Foundry | `POST /api/tasks/enqueue` with standard task object |

## Authority

Goals/AC confirm: human. Validate/complete: Foundry. Sandbox coding: workers.

## Non-goals

Pi/Goose as implementers; FE→Dragonfly; removing REST endpoints; multi-worker Esc in MVP.
