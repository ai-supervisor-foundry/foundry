---
project: Foundry — UI Layer (backend API + frontend dashboard)
scope: Express API server and React frontend for supervisor monitoring/control
---

# Foundry UI/ — Agent Instructions

Read `../supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Key Sections

- State schema: `../supervisor-contexts/state-management.md`
- Task schema: `../supervisor-contexts/task-schema.md`
- Configuration: `../supervisor-contexts/configuration.md`
- Queue system: `../supervisor-contexts/queue-system.md`
- Logging & auditability: `../supervisor-contexts/logging-auditability.md`

## Structure

- `backend/` — Express API server (ioredis + PostgreSQL); see [`backend/CLAUDE.md`](backend/CLAUDE.md)
- `frontend/` — React dashboard; see [`frontend/CLAUDE.md`](frontend/CLAUDE.md)

## Data Layer

- **PostgreSQL** (port 5433 on host → 5432 in container): projects, tasks, task_runs, audit_log — managed by `backend/src/services/db.ts`
- **DragonflyDB/Redis** (port 6499): supervisor state, task queue (hot path only)

## Navigation

Parent: [`../CLAUDE.md`](../CLAUDE.md)

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.

## Cursor Rules

- **always/supervisor-specs**: Operator goals only, no scope expansion
- **secrets**: Never print secrets. **mcp**: Tool fail → halt.
