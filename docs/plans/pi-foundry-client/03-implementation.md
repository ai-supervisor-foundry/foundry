# 03 — Implementation

## Contracts

### `POST /api/tasks/draft-ac`

```text
Request:  { prompt: string, project_id: string, goal_id?: string, upgrade?: boolean }
Response: { acceptance_criteria: string[], model_used: string }
```

- `upgrade: false/omitted` → Ollama; `upgrade: true` → strategy primary  
- All-at-once (no stream v1); dedicated AC draft prompt template  
- Does **not** enqueue  

### Confirm → enqueue

Build a normal **work** task and **`POST /api/tasks/enqueue`**. No new enqueue API.

| `task_id` | **Client** generates on confirm (TUI, web, or other): `foundry-{project_id}-{ulid}`. Server may also assign if omitted later. |
| `instructions` | Confirmed prompt text |
| `acceptance_criteria` | Confirmed checklist |
| `meta.origin` | `"tui"` \| `"web"` \| `"api"` (who enqueued) |
| `meta.client_session_id` | Optional: resumable **client** conversation id (drafts/focus) — not the event stream cursor |

**Do not** enqueue conversation turns as Foundry tasks. Only Confirm creates a work task.

### Client session vs event cursor

| ID | Meaning |
|----|---------|
| `client_session_id` | Operator conversation in the client (drafts, focus). Resume chat context. |
| `task_id` | Work unit on the Foundry queue (worker runs this; events tagged with it). |
| worker `session_id` | Provider `--resume` (existing). |
| `last_event_id` / seq | **Catch-up cursor** for the event bus — so a TUI does not miss updates after disconnect |

Creating/resuming a client session does **not** create task ids. Confirm does.  
SSE/replay: client sends `Last-Event-ID` (or `after=seq`) on reconnect — **not** `session_id` alone (session ≠ missed-event log).

Flag: `meta.origin` + optional `meta.client_session_id` — not a “conversation task” type on the work queue.

### `POST /api/tasks/:taskId/cancel` (Phase 4)

Cancel focused task → `cancelled` + kill its worker. MVP: single active worker.

### `GET /api/events` (SSE)

UI backend subscribes to Dragonfly PubSub and forwards. Clients use EventSource (browser) or HTTP SSE client (TUI).

## Phases

| Order | Work |
|-------|------|
| 1 | draft-ac + Cockpit AC UI + enqueue via existing API + journey/functional tests |
| 2 | S0 schema + PubSub + SSE skeleton |
| 3 | S1 one provider streams |
| 4 | Per-task cancel (single-worker MVP) |
| 5 | S2 timeline in Cockpit (SSE + keep poll) |
| 6 | Think better |
| 7 | Recipes |
| 8 | S+ adapters (later research/test) |

## Journeys & tests (Phase 1+)

### User journeys (dry-run / e2e-style)

1. Draft AC → edit checkboxes → confirm → task appears in queue  
2. Draft → abandon (no enqueue)  
3. Draft → Think better → confirm  
4. Empty/vague prompt → drafter/UI behavior  
5. Confirm with zero AC checked → reject or block  
6. (Later) Watch SSE events for running task  
7. (Later) Esc cancel → `cancelled`, loop still running  

### Non-user / functional

- `draft-ac` contract (Ollama + upgrade flag)  
- Enqueue still validates required fields  
- draft-ac never writes queue  
- PubSub message round-trip → SSE payload shape  
- Cancel unknown task_id → 404; cancel completed → 409  
- Subscribe reconnect/breaker behavior  

## Acceptance (Phase 1 minimum)

- [ ] draft-ac + checkbox confirm + existing enqueue  
- [ ] Draft alone does not enqueue  
- [ ] Journey + functional tests above for Phase 1 paths  
- [ ] REST poll endpoints unchanged  

## Risks

| Risk | Mitigation |
|------|------------|
| Dual pipes vs takeover | Same PubSub; takeover subscribes later |
| FE→Redis | Forbidden; bridge in UI backend |
| Parallel Esc | Deferred; document MVP single worker |

## Open (non-blocking for Phase 1)

- Takeover WS vs SSE — PubSub stays; client protocol can differ later  

**TUI:** post-MVP; design HTTP/SSE so a TUI can attach later without a second bus.
