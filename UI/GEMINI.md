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

## Structure

- `backend/` — Express API server (ioredis, supertest tests)
- `frontend/` — React dashboard

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.

## Cursor Rules

- **always/supervisor-specs**: Operator goals only, no scope expansion
- **secrets**: Never print secrets. **mcp**: Tool fail → halt.
