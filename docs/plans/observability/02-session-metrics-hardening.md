# 02 — Session Metrics Hardening

**Status:** Not started  
**Priority:** Low–Medium  
**Review:** Incorporated 2026-06-13 ([REVIEW-INSIGHTS.md](../REVIEW-INSIGHTS.md))

**Builds on:** [01-session-metrics.md](../done/observability/01-session-metrics.md) (COMPLETED)

---

## Problem (code-verified)

| Gap | Current |
|-----|---------|
| Persist path | `{sandboxRoot}/{task.project_id}/session-metrics.json` — global totals in project dir |
| CLI read | First goal's project only (`cli.ts` ~533–581) |
| Restart | In-memory reset; no `loadFromFile` |
| Labeling | “Est.” not “(estimated)” |
| Parallel mode | Workers never call `sessionMetrics` |
| Lifespan avg | Includes in-flight session iteration counts |
| Persist errors | Silent `catch` in `persist()` |

---

## Affected files

| File | Change |
|------|--------|
| `sessionMetrics.ts` | `loadFromFile()`, root persist path, lifespan fix, warn on persist fail |
| `controlLoop/index.ts` | Load on init; persist to sandbox root; optional state mirror |
| `cli.ts` `showMetrics` | Read `{sandboxRoot}/session-metrics.json`; “(estimated)” label |
| `worker.ts` | Instrument session create/reuse OR document parallel unsupported |
| `types.ts` | Optional `supervisor.session_metrics_summary` |
| `sessionMetrics.test.ts` | persist → reset → load round-trip |

---

## Tasks

**0. Parallel mode** — Either hook `taskExecutor` equivalent in worker, or document `MAX_WORKERS>1` metrics as best-effort until worker wiring lands.

**1. Canonical path:** `{sandboxRoot}/session-metrics.json` (not per-project)

**2. `loadFromFile()`** — call at control loop start before first task

**3. Label `(estimated)`** — logs (`formatSummaryLine`) + CLI Session Health for token savings

**4. Lifespan** — average only **closed** sessions; exclude active `featureSessionIterations` from avg

**5. Persist failures** — `logError` + visible warn (not empty catch)

**6. Optional:** mirror summary to `state.supervisor.session_metrics_summary` on periodic persist

**7. CLI** — stop using first-goal project path; read sandbox root file

---

## Acceptance criteria

- [ ] Metrics survive supervisor restart (load test)
- [ ] Single file at sandbox root
- [ ] CLI shows “(estimated)” for savings
- [ ] persist → reset → load unit test passes
- [ ] Lifespan excludes in-flight sessions

---

## Out of scope

- Dashboard widget
- Billing-accurate tokens
- Redis mirror (optional future)
