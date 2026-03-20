---
project: Foundry — UI Backend API
scope: Express server, Redis state reader, task queue API, project management
---

# Foundry UI/backend/ — Agent Instructions

Read `../../supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Key Sections

- State schema: `../../supervisor-contexts/state-management.md`
- Task schema: `../../supervisor-contexts/task-schema.md`
- Queue system: `../../supervisor-contexts/queue-system.md`
- Configuration: `../../supervisor-contexts/configuration.md`

## Architecture

- `src/app.ts` — Express app factory (`createApp()`)
- `src/routes/` — API routes (state, tasks, commands, projects, logs, config, ollama)
  - Tasks: enqueue, enqueue-bulk, update, delete (bulk by source), queue, completed, blocked, dump
  - Config: GET config, GET/POST settings, CRUD strategies, CRUD execution-modes (ordered: builtin first, then by created_at ASC), GET/POST preferences
- `src/services/` — supervisorState (ioredis), queueService (ioredis), projectService (pg), db (pg pool + migrations + seed), logReader
- `src/services/db.ts` — pg Pool, `runMigrations()` + `seedDefaults()` (auto on startup), `writeAuditLog()`, `getSetting()`/`setSetting()`; tables: projects, tasks, task_runs, audit_log, settings, strategies, execution_modes

## Testing

- **Jest** + supertest for API tests (`tests/api.test.ts`). Run: `npx jest --verbose`
- `tests/setup.ts` — mocks ioredis, logReader, projectService, db (in-memory), child_process, fs/promises
- DB mock (`tests/setup.ts`) provides in-memory settings store + execution_modes table with `_reset()`/`_addExecutionMode()` helpers
- Preferences validation: execution modes validated against DB (not hardcoded list) — custom modes from `execution_modes` table are accepted

## Navigation

Parent: [`UI/CLAUDE.md`](../CLAUDE.md)

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.
