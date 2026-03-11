# Foundry — Agent Instructions

## Project Brief

Foundry is a **persistent orchestration layer for AI-assisted software development**—restart-safe, operator-controlled, fully auditable. It externalizes memory, intent, and control so work continues across interruptions.

**Workflow**: `Operator: Boilerplates + Tasks + Goal → Foundry: Execute → Validate → Persist → Continue`

**Critical rules**: Operator injects goals; scope cannot expand; all tasks need acceptance criteria; state persisted every step; ambiguity halts. If unspecified → STOP and ask operator.

## Full Documentation

Read `supervisor-contexts/CONTEXT.md` for the index. Section files: overview, architecture, control-loop, state-management, validation, tool-contracts, usage, etc.

## Always-Apply Behavioral Rules

0. Be concise unless asked for elaboration.
1. Propose = suggest without edits.
2. Max 6 line changes at a time; announce, wait for review, then proceed.
4. After root cause/fix identified, NEVER run commands—verify I approve.
5. Check MCP availability before asking.
6. Questions → answer only, no mutating actions.
7. Mistake → alert, inform, halt. No changes.

## Referenced Rules (read when relevant)

- **Cleanup**: `.cursor/rules/cleanup.mdc` — ask before cleanup/delete; use ./tmp for *.baks
- **PM2**: `.cursor/rules/pm2.mdc` — logs always `--nostream`; halt→stop→rebuild→restart→resume
- **Secrets**: `.cursor/rules/secrets.mdc` — never print secrets; shell length check
- **MCP**: `.cursor/rules/mcp.mdc` — tool fail → report and halt
- **Restart**: `.cursor/rules/restart.mdc` — lifecycle when restarting
- **Task lifecycle**: `.cursor/rules/task-lifecycle.mdc` — blocked tasks never autocompleted

## Conditional Contexts

- **Project details**: README.md, ./docs/*.md (not ./docs/plans unless working on a plan)
- **Foundry system**: ./supervisor-contexts (read specific section files as needed)
- **Sandbox projects**: ./contexts/sandbox/
