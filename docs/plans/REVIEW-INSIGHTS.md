# Plan + Code Review Insights (2026-06-13)

Senior-engineer review of merged plans vs shipped code. Backups: `tmp/plan-backups/2026-06-13/`.

**Plan docs status:** Updated 2026-06-14 — CRG plans removed via [crg-yagni-removal](./done/crg-yagni-removal/); git context / worktree cwd kept.

## Summary Verdicts

| Plan | Verdict | Status |
|------|---------|--------|
| [04-per-project-goal-check](./prompt-context/04-per-project-goal-check.md) | Ready to implement | Plan fixed |
| [02-helper-fallback-chain](./helper-agent/02-helper-fallback-chain.md) | Ready to implement | Plan fixed |
| [02-session-metrics-hardening](./observability/02-session-metrics-hardening.md) | Ready to implement | Plan fixed |
| [02-hybrid-memory-hardening](./v2-architecture-gaps/02-hybrid-memory-hardening.md) | Ready to implement | Plan fixed |
| [crg-yagni-removal](./done/crg-yagni-removal/) | Strip CRG product surface | Done |

---

## Cross-cutting findings

1. **Parallel mode gaps** — Workers bypass session metrics; ~~worktree cwd not passed to `taskExecutor` / retry paths~~ **Fixed** → stale `file_paths` in parallel mode resolved.
2. **Bulk goal marking** — `controlLoop/index.ts` and `scheduler/index.ts` mark all goals complete on one check — conflicts with per-project design.
3. **Session key mismatch** — Goal check uses `default`/`firstProjectId`; tasks use `project:${id}`.
4. **CLI `--sandbox-root`** — Not passed on halt/resume/set-goal → backup/fallback may silently skip.
5. **Docs conflict** — `configuration.md` deprecates `USE_LOCAL_HELPER_AGENT`; code and `.env.example` still use it.

---

## Per-plan detail

### 04 Per-project goal check
- **Aligned:** Plan correctly describes monolithic stopgap still in code.
- **Missed in plan:** `scheduler/index.ts`; bulk mark loops; `shouldHalt` on partial; blocked_tasks filter in pseudocode; worktree cwd.
- **Shipped 01 issues:** Wrong session key; all-or-nothing completion; tests validate stopgap not target.
- **Action:** Plan updated — see § Affected files in 04.

### Shared git context (kept after CRG YAGNI removal)
- **Done:** worktree cwd; `gitContext.ts` + `gitContextCache.ts`; cache via `git_execution_seq`; async `execFile` in prompt hot path.
- **Deferred:** `validateFilePaths()` on deleted paths; monorepo + full worktree integration fixture tests.
- **Removed:** CRG adapter / `graph_context` injection (see [crg-yagni-removal](./done/crg-yagni-removal/)).

### 02 Helper fallback
- **Insight:** `useLocalModel=false` already gets full secondary chain via `CLIAdapter`.
- **Fix:** Prepend Ollama to adapter entries; don't duplicate dispatch loop.
- **Action:** Plan updated; reconcile with `configuration.md`.

### 02 Session metrics hardening
- **Insight:** Global singleton written to per-project path; CLI reads first goal only; workers uninstrumented.
- **Action:** Implement 02 tasks 1–3; defer Redis mirror.

### 02 Hybrid memory hardening
- **Insight:** Null-key fallback confirmed; halt async race; tests encode behavior to remove.
- **Action:** CLI sandboxRoot fix → null-key throw → halt sync write.

---

## Recommended implementation order

1. **Hybrid hardening** (safety) + **CLI sandboxRoot wiring**
2. ~~**Worktree cwd plumbing**~~ — done (F01)
3. **Per-project goal check**
4. **Helper fallback** via CLIAdapter reorder
5. ~~**Git context extract** + cache + async~~ — done (05)
6. **Session metrics hardening**

---

## Review agents

- Goal check: [c6935978-a83e-4bfd-bb69-8c336ca2434c](c6935978-a83e-4bfd-bb69-8c336ca2434c)
- Git context: [1a66d4c7-f91e-441f-89c6-a53664927cdc](1a66d4c7-f91e-441f-89c6-a53664927cdc)
- Helper: [bdc1cfe4-1fbd-4514-8d3a-fa1170a883ec](bdc1cfe4-1fbd-4514-8d3a-fa1170a883ec)
- Session metrics: [7bc1712d-35be-401e-b0ea-5902c43923fb](7bc1712d-35be-401e-b0ea-5902c43923fb)
- Hybrid memory: [c364d465-e400-41dc-9e9c-715abf77ee4a](c364d465-e400-41dc-9e9c-715abf77ee4a)
