---
project: Foundry — Test suite (unit + functional)
scope: Jest tests with stubbed Redis, filesystem, and provider mocks
---

# Foundry tests/ — Agent Instructions

Read `../supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Key Sections

- Validation pipeline: `../supervisor-contexts/validation.md`
- State schema: `../supervisor-contexts/state-management.md`
- Task schema: `../supervisor-contexts/task-schema.md`
- Control loop: `../supervisor-contexts/control-loop.md`

## Test Infrastructure

- `mocks/` — Stubbed Redis, filesystem, CLI adapters, providers
- `helpers/` — State/task builders (`TaskBuilder.withTool()`, `StateBuilder`) for test setup
- `fixtures/` — Mock data and Redis fixtures
- `functional/scenarios/` — End-to-end control loop scenarios
- `setup.ts` — Global mocks (process.exit, ioredis, fs, child_process)

## Key Test Areas

- `unit/application/services/controlLoop/modules/taskExecutor.test.ts` — Working directory resolution, provider override via `task.tool`, prompt metadata logging

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.

## Cursor Rules

- **task-lifecycle**: Blocked tasks → pending, never autocomplete
- **always/supervisor-specs**: Operator goals only, deterministic validation
