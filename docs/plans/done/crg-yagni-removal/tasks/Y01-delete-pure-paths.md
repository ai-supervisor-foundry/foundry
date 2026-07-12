---
id: Y01
status: done
depends_on: []
---

# Y01 — Delete pure CRG paths + install junk

## Scope

Remove files/dirs that exist only for CRG. No mixed-file surgery.

## Delete (tracked / staged adds)

**Core**
- `src/config/codeReviewGraph.ts`
- `src/domain/ports/codeReviewGraphPort.ts`
- `src/infrastructure/connectors/codeIntelligence/` (entire dir)

**Scripts / fixtures / tests**
- `scripts/crg.sh`, `scripts/crg-eval-fixture.sh`
- `tests/fixtures/crg/`
- `tests/unit/config/codeReviewGraph.test.ts`
- `tests/unit/infrastructure/codeReviewGraphAdapter.test.ts`
- `tests/unit/infrastructure/crgMcpHandshake.test.ts`
- `tests/unit/application/services/controlLoop/modules/validationOrchestrator.crg.test.ts`

**UI**
- `UI/backend/src/routes/crg.ts`
- `UI/backend/src/services/crgDashboard.ts`
- `UI/backend/src/services/crgEnv.ts`
- `UI/backend/src/services/supervisorPaths.ts` (CRG-only consumer)
- `UI/backend/tests/crgDashboard.test.ts`, `crgEnv.test.ts`
- `UI/frontend/src/components/CrgDashboardPanel.tsx`

**Plans (entire trees)**
- `docs/plans/code-review-graph/`
- `docs/plans/crg-ui-dashboard/`
- `docs/plans/foundry-root-crg/`
- `docs/plans/done/code-review-graph/`
- `docs/plans/done/crg-known-issues-fixes/`

## Delete (untracked install)

- `.cursor/mcp.json`, `.mcp.json`, `.cursorrules`
- `.claude/skills/explore-codebase/`, `review-changes/`, `debug-issue/`, `refactor-safely/`
- `.claude/settings.json` if only CRG hooks (else strip hooks in Y03)

## Keep (do not delete)

- `AGENTS.md` — operator-owned Foundry agent instructions (rewritten; not CRG install junk). Still untracked until committed separately.

## Delete (local artifacts, not git)

- `.crg-venv/`, `.code-review-graph/` (ask before `rm -rf` if large)

## Acceptance

- Listed paths gone from working tree
- Stop for operator review before Y02

## Out of scope

- Editing `package.json`, `app.ts`, `Settings.tsx`, `promptBuilder.ts`, etc.
