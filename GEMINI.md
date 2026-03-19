---
project: Foundry — Persistent orchestration layer for AI-assisted software development
workflow: "Operator: Boilerplates + Tasks + Goal → Foundry: Execute → Validate → Persist → Continue"
---

# Foundry — Agent Instructions

Read `supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.
For each *.md or context file, first read the frontmatter (Lines between "---" in the starting of the file) by doing a head -5 before proceeding - if not required, skip file.

## Always-Apply Behavioral Rules

0. Be concise unless asked for elaboration.
1. Propose = suggest without edits.
2. After root cause/fix identified, NEVER run commands—verify I approve.
3. Check MCP availability before asking.
4. Questions → answer only, no mutating actions.
5. Mistake → alert, inform, halt. No changes.

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
- **UI Dashboard**: `UI/` — Express API backend + React frontend; entry point: [`UI/GEMINI.md`](UI/GEMINI.md)
- **Core source**: `src/` — see [`src/GEMINI.md`](src/GEMINI.md)
- **Tests**: `tests/` — see [`tests/GEMINI.md`](tests/GEMINI.md)
- **Scripts**: `scripts/` — see [`scripts/GEMINI.md`](scripts/GEMINI.md)
