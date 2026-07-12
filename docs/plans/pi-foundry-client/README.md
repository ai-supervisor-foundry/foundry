# Foundry Cockpit — Plan Index

Operator-facing **Foundry Cockpit** (same Vite UI app): human prompt → confirmed task → live worker view → per-task cancel. Foundry keeps the deterministic loop, workers, validation. Pi/Goose are optional later skins.

**Status:** Review decisions locked (2026-07-11) — Phase 1 ready after journeys/tests noted below  
**Companion canvas:** Cursor-local summary; **this folder is source of truth**

## Locked decisions

| Topic | Decision |
|-------|----------|
| Product core | Foundry Cockpit in existing `UI/frontend` (new route/view) |
| Prompt → task | Prompt → Ollama draft AC → checkbox UI → confirm → **existing** `POST /api/tasks/enqueue` |
| `task_id` | **Client** (TUI/web/…) generates on confirm (`foundry-{project}-{ulid}`); optional `meta.client_session_id` |
| Client session | Resumable operator conversation (drafts) — **not** a work-queue task; **not** the event cursor |
| Event catch-up | `last_event_id` / seq on reconnect (SSE Last-Event-ID) — not session_id |
| Think better | Optional; strategy primary; Ollama default |
| draft-AC | `POST /api/tasks/draft-ac` (see [03](./03-implementation.md)) |
| Cancel | Terminal status `cancelled`; Esc kills focused task worker; loop continues |
| Cancel MVP | **Single active worker**; parallel targeting deferred |
| Event schema | Flat `type` + `source` (see [02](./02-workstreams.md)) |
| Event transport | Dragonfly **PubSub** (publish) → UI backend → **SSE** to clients; **REST poll kept** |
| Clients | Browser talks to **UI backend only** (never Dragonfly); **TUI post-MVP** same APIs |
| Recipes | Phase 7 (unchanged) |
| Session reuse | Correlate `session_id` on events only |
| Goose / Pi | Ideas/skins later; not core |

## Sub-Plans

| # | File | Scope |
|---|------|-------|
| 1 | [01-overview.md](./01-overview.md) | Topology, prompt→task |
| 2 | [02-workstreams.md](./02-workstreams.md) | Bus, cancel, schema |
| 3 | [03-implementation.md](./03-implementation.md) | Contracts, phases, journeys, tests |

## One-liner

Type intent → confirm AC → enqueue via existing API → watch/cancel that task live (SSE + poll).
