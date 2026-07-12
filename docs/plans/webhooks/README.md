# Webhooks — Plan Index

External systems (CI/CD pipelines, GitHub, etc.) push events to the supervisor, automatically creating tasks.

**Example**: CI detects failing tests → sends webhook → supervisor auto-creates a fix task.

## Sub-Plans

| # | File | Scope |
|---|------|-------|
| 1 | [01-overview.md](./01-overview.md) | Concept, event types, security, deduplication |
| 2 | [02-backend.md](./02-backend.md) | REST endpoints, auth middleware, task creation logic |
| 3 | [03-frontend.md](./03-frontend.md) | Settings UI, webhook configuration, history |
| 4 | [04-implementation.md](./04-implementation.md) | Steps, dependencies, risks |

## Key Points

- **Test-failure webhook** — primary use case, converts CI failures into supervisor tasks
- **Generic webhook** — for any external event
- **Authentication** — HMAC signature or bearer token
- **Rate limiting** — per-IP and per-project caps
- **Deduplication** — Redis TTL keys prevent duplicate task enqueue
- **Audit trail** — `source: "webhook"` metadata on all webhook-created tasks
