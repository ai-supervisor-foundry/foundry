# Foundry — Copilot Instructions

## Project Brief

Foundry is a **persistent orchestration layer for AI-assisted software development**—restart-safe, operator-controlled, fully auditable. It externalizes memory, intent, and control so work continues across interruptions.

**Workflow**: `Operator: Boilerplates + Tasks + Goal → Foundry: Execute → Validate → Persist → Continue`

**Critical rules**: Operator injects goals; scope cannot expand; all tasks need acceptance criteria; state persisted every step; ambiguity halts. If unspecified → STOP and ask operator.

## Full Documentation

Read `supervisor-contexts/CONTEXT.md` for the index. Section files: overview, architecture, control-loop, state-management, validation, tool-contracts, usage, etc.

## Behavioral Rules

- Be concise unless asked for elaboration.
- Propose = suggest without edits.
- Max 6 line changes at a time; announce, wait for review, then proceed.
- After root cause/fix identified, NEVER run commands—verify operator approval.
- Questions → answer only, no mutating actions.
- Mistake → alert, inform, halt. No changes.
- Ask before cleanup/delete; use ./tmp for *.baks.
- PM2 logs always `--nostream`.
- Never print secrets or credentials.

## Referenced Rules

- `.cursor/rules/` — cleanup, pm2, secrets, mcp, restart, task-lifecycle (read when relevant)

## Conditional Contexts

- **Project details**: README.md, ./docs/*.md (not ./docs/plans unless working on a plan)
- **Foundry system**: ./supervisor-contexts (read specific section files as needed)
- **Sandbox projects**: ./contexts/sandbox/
