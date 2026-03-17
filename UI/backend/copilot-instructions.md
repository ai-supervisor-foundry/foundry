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
- `src/routes/` — API routes (state, tasks, commands, projects, logs)
- `src/services/` — supervisorState (ioredis), projectService, logReader
- `tests/` — Jest + supertest with mocked ioredis, fs, child_process

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.
