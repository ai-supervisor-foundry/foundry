---
id: Y03
status: done
depends_on: [Y02]
---

# Y03 — Strip CRG from docs / contexts / env / index

## Files

| File | Action |
|------|--------|
| `.env.example` | Remove `FOUNDRY_CRG_*` block |
| `.gitignore` | Remove `.code-review-graph/`, `.crg-venv/` (keep `sandbox/state.json`, `.foundry/`) |
| `README.md` | Remove “Code Review Graph (Optional)” section |
| `CLAUDE.md` | Remove injected `## MCP Tools: code-review-graph` block; keep rule renumbering |
| `UI/CLAUDE.md` | Remove CRG mention if any |
| `supervisor-contexts/configuration.md` | Remove CRG section / flag table |
| `supervisor-contexts/tool-prompt-construction.md` | Remove `graph_context` bullets |
| `supervisor-contexts/key-components.md` | Remove CRG row |
| `supervisor-contexts/CONTEXT.md` | Remove CRG index line if present |
| `docs/plans/README.md` | Remove CRG plan rows; add this plan under active; drop “Recently shipped” CRG lines or point to removal |
| `docs/plans/REVIEW-INSIGHTS.md` | Drop or reword CRG-only insights |
| `.claude/settings.json` | Delete or strip CRG hooks |

## Optional (operator)

- `~/.cursor/hooks.json` — review manually; not in-repo

## Acceptance

- Contexts/README no longer instruct operators to enable CRG
- Plan index lists `crg-yagni-removal` instead of active CRG feature plans
- Stop for Y04
