---
project: Foundry — Persistent orchestration layer for AI-assisted software development
workflow: "Operator: Boilerplates + Tasks + Goal → Foundry: Execute → Validate → Persist → Continue"
---

# Foundry — Agent Instructions

Read `supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Behavioral Rules

- Be concise unless asked for elaboration. Propose = suggest without edits.
- Max 6 line changes at a time; announce, wait for review, then proceed.
- After root cause/fix identified, NEVER run commands—verify operator approval.
- Questions → answer only, no mutating actions. Mistake → alert, inform, halt.

## Cursor Rules (`.cursor/rules/`)

- **always/supervisor-specs**: Operator goals only, no scope expansion, deterministic validation
- **task-lifecycle**: Blocked tasks → set to pending, never autocomplete
- **cleanup**: Ask before delete; use ./tmp for backups
- **pm2**: Logs `--nostream`; lifecycle: halt→stop→rebuild→restart→resume
- **secrets**: Never print secrets. **mcp**: Tool fail → halt. **restart**: Same lifecycle as pm2.
- **contexts**: Read CONTEXT.md first for system docs; contexts/ for project docs

## Conditional Contexts

- **System docs**: `supervisor-contexts/` (read section files as needed)
- **Project details**: `README.md`, `docs/*.md`
- **Sandbox projects**: `contexts/sandbox/`
