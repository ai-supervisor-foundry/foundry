---
project: Foundry — Persistent orchestration layer for AI-assisted software development
workflow: "Operator: Boilerplates + Tasks + Goal → Foundry: Execute → Validate → Persist → Continue"
---

# Foundry — Agent Instructions

Read `supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Always-Apply Behavioral Rules

0. Be concise unless asked for elaboration.
1. Propose = suggest without edits.
2. Max 6 line changes at a time; announce, wait for review, then proceed.
4. After root cause/fix identified, NEVER run commands—verify I approve.
5. Check MCP availability before asking.
6. Questions → answer only, no mutating actions.
7. Mistake → alert, inform, halt. No changes.

## Cursor Rules (`.cursor/rules/`)

- **always**: Concise responses, propose-only, 6-line limit, verify approval, questions=answer-only, halt on mistakes
- **supervisor-specs**: Operator goals only, no scope expansion, deterministic validation, no anti-goals
- **task-lifecycle**: Blocked tasks never autocompleted — set to pending for supervisor
- **cleanup**: Ask before cleanup/delete; use ./tmp for *.baks
- **pm2**: Logs always `--nostream`; lifecycle: halt→stop→rebuild→restart→resume
- **secrets**: Never print secrets; shell-based length check only
- **mcp**: Tool fail → report and halt
- **restart**: Halt→stop→rebuild→restart→resume
- **contexts**: Read CONTEXT.md first; use supervisor-contexts/ for system, contexts/ for projects

## Conditional Contexts

- **System docs**: `supervisor-contexts/` (read specific section files as needed)
- **Project details**: `README.md`, `docs/*.md` (not `docs/plans` unless working on a plan)
- **Sandbox projects**: `contexts/sandbox/`
