# 02 — Workstreams

## Prompt → task + AC

Watch points: vague AC; Think better cost; never enqueue on draft; drafter must not invent goals.

## Event bus

### Schema (locked)

Flat fields (not dotted hierarchy):

```json
{
  "type": "thought | tool_start | tool_update | tool_end | settled | cancelled | validation | status",
  "source": "worker | foundry | ui",
  "task_id": "...",
  "project_id": "...",
  "session_id": "...",
  "ts": "ISO-8601",
  "payload": {}
}
```

### Transport (locked)

| Layer | Choice |
|-------|--------|
| Internal fan-out | Dragonfly/Redis **PubSub** (supervisor publishes) |
| Browser / TUI | UI backend **SSE** (`GET /api/events?...`) |
| Snapshot / control | Existing **REST** — **keep polling** for state/queue |

Pattern: push for live timeline; poll (or fetch-on-SSE-gap) for authoritative state. Do not delete poll endpoints.

Reconnect: 5 attempts, 5s breaker, then error “try again in a minute.”

### Why not FE → Dragonfly

Browsers must not hold Redis credentials or speak PubSub. Backend bridges ([common practice](https://oneuptime.com/blog/post/2026-03-31-redis-websocket-bridge-pubsub/view)). Same for TUI: HTTP to UI backend (SSE and/or REST).

### Phases

| Phase | Outcome |
|-------|---------|
| S0 | Schema + PubSub channel(s) |
| S1 | One provider publishes worker events |
| Cancel | Esc → cancel task + worker |
| S2 | Cockpit SSE consumer + REST poll retained |
| S+ | Other stream adapters — research/test later |

## Per-task cancel

- New status: `cancelled` (terminal; re-run = new enqueue)
- New: `cancelWorker(taskId)` (or equivalent); MVP **one** active worker
- Not `workerPool.halt()` (kills all)

## Session reuse

Footnote: attach `session_id` on events when present.
