---
id: Y02
status: done
depends_on: [Y01]
---

# Y02 — Strip CRG hunks in src / UI / package / compose

## Rule

Per file: remove CRG-only lines; keep git cwd, session metrics, unrelated edits. Prefer small diffs; announce between batches.

## Files + ranges (intent)

| File | Remove | Keep |
|------|--------|------|
| `package.json` | all `crg*` scripts | rest |
| `docker-compose.yml` | `code-review-graph` service, `crg-home` volume | rest |
| `UI/backend/src/app.ts` | `crgRoutes` import + `/api/crg` mount | rest |
| `UI/backend/src/routes/config.ts` | `/crg-flags` routes + `crgEnv` import | rest |
| `UI/frontend/src/services/api.ts` | `getCrg*` / `installCrg*` / `saveCrgFlag` | rest |
| `UI/frontend/src/pages/Settings.tsx` | CRG section, flags state, `CrgDashboardPanel` | other sections |
| `UI/frontend/src/pages/CommandExecutor.tsx` | `CRG_SHELL_PRESETS` + buttons | rest |
| `src/.../controlLoop/index.ts` | adapter init / port wiring | `bumpGitContextExecutionSeq`, non-CRG |
| `src/.../workers/worker.ts` | CRG adapter wiring | git bump / metrics |
| `src/.../taskExecutor.ts` | `CodeReviewGraphPort` | `resolveTaskSandboxCwd`, sessionMetrics |
| `src/.../validationOrchestrator.ts` | CRG port pass-through | rest |
| `src/.../retryOrchestrator.ts` | CRG port | git bump |
| `src/.../maxRetriesStrategy.ts` | CRG port | git bump |
| `src/.../interrogationValidator.ts` | CRG port | git bump |
| `src/.../scheduler/index.ts` | `initializeCodeReviewGraph` | rest |
| `src/domain/agents/promptBuilder.ts` | `graph_context` inject | `gitContext` / `file_paths` |
| `src/.../providers/claudeCLI.ts` | CRG MCP config | other CLI changes |
| `src/.../providers/cursorCLI.ts` | CRG MCP merge | other CLI changes |
| Matching `*.test.ts` | CRG-only asserts / mocks | rest |

## Acceptance

- No compile refs to deleted CRG modules
- `resolveTaskSandboxCwd` + `gitContext*` still used
- Stop for review before Y03
