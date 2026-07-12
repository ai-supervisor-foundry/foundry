# Prompt Context — Plan Index

Small, independent prompt/context improvements. Code-verified gaps (2026-06).

| # | File | Scope | Status |
|---|------|-------|--------|
| 1 | [01-goal-completion-fix.md](../done/prompt-context/01-goal-completion-fix.md) | Run goal check from sandbox root; remove hardcoded project paths | **COMPLETED** (superseded by #4) |
| 2 | [02-sandbox-file-paths.md](../done/prompt-context/02-sandbox-file-paths.md) | Git-changed file paths in `MinimalState` | **COMPLETED** ([05](../done/code-review-graph/05-shared-git-context.md) done) |
| 3 | [03-pre-context-injection.md](./03-pre-context-injection.md) | Brief context on provider fallback / helper / retry | **Not started** |
| 4 | [04-per-project-goal-check.md](./04-per-project-goal-check.md) | Per-project goal checks (merges per-project-goals + cwd fix) | **Not started** |

**Suggested order:** 4 → 3
