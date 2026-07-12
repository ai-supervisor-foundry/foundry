---
id: crg-yagni-removal
status: done
goal: Remove code-review-graph product surface from uncommitted chore/updates work; keep git cwd / file_paths / session-metrics value
---

# CRG YAGNI Removal

Strip **CRG** (adapter, flags, UI, plans, MCP install) from the dirty `chore/updates` tree. **Do not** `git reset --hard` / `git clean -fd`.

**Related (deleted during this plan):** former `code-review-graph/`, `crg-ui-dashboard/`, `foundry-root-crg/`, `done/crg-known-issues-fixes/`, `done/code-review-graph/`

## Why

Operator eval: CRG helps some investigations, not default Foundry feature work. Integration is uncommitted and opt-in; YAGNI says remove until a clear operator goal reintroduces it.

## Non-goals

- Nuclear reset of the whole working tree
- Removing `gitContext` / worktree `sandboxCwd` / `sessionMetrics`
- Reverting unrelated plan reorg or prompt-contract work
- Editing `~/.cursor/hooks.json` unless operator asks (global install side-effect)

## Keep (valuable without CRG)

| Asset | Reason |
|-------|--------|
| `src/infrastructure/connectors/git/gitContext.ts` + `gitContextCache.ts` | `file_paths` / git root for prompts |
| `ActiveTask.git_context*` / `git_execution_seq` | Cache invalidation for git diffs |
| `resolveTaskSandboxCwd` + worktree cwd plumbing | Parallel / worktree correctness |
| `sessionMetrics` + CLI session health | Observability (separate plan) |
| Non-CRG `CLAUDE.md` rule edits | Operator workflow rules |
| `AGENTS.md` | Operator-owned agent instructions (not CRG junk; do not delete in Y01) |
| `.gitignore` entries for `sandbox/state.json`, `.foundry/` | Unrelated hygiene |

## Delete entire (pure CRG)

See [tasks/Y01-delete-pure-paths.md](./tasks/Y01-delete-pure-paths.md).

## Mixed files (strip CRG hunks only)

See [tasks/Y02-strip-mixed-src-ui.md](./tasks/Y02-strip-mixed-src-ui.md) and [tasks/Y03-strip-mixed-docs-config.md](./tasks/Y03-strip-mixed-docs-config.md).

## Phases

| Phase | Card | Scope | Stop for review |
|-------|------|-------|-----------------|
| 1 | [Y01](./tasks/Y01-delete-pure-paths.md) | Delete pure paths + untracked install + local artifacts | Yes |
| 2 | [Y02](./tasks/Y02-strip-mixed-src-ui.md) | Strip CRG from `src/` + `UI/` + `package.json` + compose | Yes |
| 3 | [Y03](./tasks/Y03-strip-mixed-docs-config.md) | Strip CRG from README, contexts, `.env.example`, plan index | Yes |
| 4 | [Y04](./tasks/Y04-verify.md) | `rg` zero-check + targeted unit tests | Yes |

## Acceptance

- `rg -i 'FOUNDRY_CRG|codeReviewGraph|graph_context|/api/crg|CrgDashboard'` → no hits under `src/`, `UI/`, `scripts/`, `tests/` (except historical notes operator explicitly kept)
- Foundry builds/tests without CRG modules
- `gitContext` / `resolveTaskSandboxCwd` / `sessionMetrics` still present
- No `git reset --hard`

## Rules

- Max small diffs per review step (operator 6-line preference when editing mixed files)
- Propose → approve → apply per phase
- Failure-safe: if unsure a hunk is CRG-only, leave it and flag
