---
project: Foundry — Supervisor core source code
scope: Application logic, domain types, infrastructure adapters, CLI entrypoint
---

# Foundry src/ — Agent Instructions

Read `../supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Key Sections

- Architecture & modules: `../supervisor-contexts/architecture.md`
- Control loop: `../supervisor-contexts/control-loop.md`
- State management: `../supervisor-contexts/state-management.md`
- Validation pipeline: `../supervisor-contexts/validation.md`
- Task schema: `../supervisor-contexts/task-schema.md`

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.

## Cursor Rules

- **always/supervisor-specs**: Operator goals only, no scope expansion, deterministic validation
- **task-lifecycle**: Blocked tasks → pending, never autocomplete
- **cleanup**: Ask before delete; ./tmp for backups
- **pm2/restart**: halt→stop→rebuild→restart→resume
- **secrets**: Never print. **mcp**: Tool fail → halt.
