# Helper Agent Optimization — Fixes v2

Status: Actionable Plan
Scope: Deterministic validation, helper prompting, metrics/observability, safety, rollout
Date: 2026-01-06

---

## Purpose
Follow-up to the first fixes plan to close remaining gaps: cache-hit visibility, stronger safety on regex/scans, richer metrics (skip-rate and latency percentiles), and clearer rollout checkpoints.

## What Changes (Delta from Fixes v1)
- Add helper session cache-hit logging/aggregation (when provider returns token cache stats).
- Emit periodic metrics summaries: deterministic skip rate, helper avg/P95 duration.
- Strengthen regex safety heuristics (reject pathological patterns) and optional ripgrep fast-path.
- Tighten scan limits and rule confidence handling for deterministic skips.
- Clarify acceptance and rollout gates with measurable thresholds.

## Action Items (Engineering)
1) Provider/cache metrics
- When provider usage includes `cached` vs `total` tokens, compute cache-hit rate; log and persist in analytics.
- Add per-feature aggregation (feature_id = `helper:validation:${projectId}`) for cache-hit and helper calls.

2) Metrics summaries
- Extend `analyticsService.logSummary()` (or a new method) to emit per-task summary at finalize and every N iterations:
  - deterministic_attempts, deterministic_success (skip rate = success/attempts)
  - helper_agent_calls, helper_duration_ms_total, helper_avg_ms, helper_p95_ms (maintain simple reservoir or capped ring buffer)
- Persist new fields in metrics.jsonl records.

3) Regex safety
- Pre-scan patterns for catastrophic forms: reject if contains `(.*){2,}`, `(.*)+`, nested quantifiers, or backtracking bombs like `(a+)+`.
- Compile regex with bounded timeout (if library support) or fall back to safe test; on error, treat as non-match.

4) Optional ripgrep fast-path
- If `USE_RIPGREP=true` and `rg` is on PATH, serve grep checks via `rg --max-filesize <cap> --hidden -uu` respecting file/byte caps. Fall back to Node scan if `rg` unavailable or errors.

5) Deterministic gating & confidence
- Maintain env gates: `HELPER_DETERMINISTIC_ENABLED`, `HELPER_DETERMINISTIC_PERCENT`, caps for files/bytes.
- Skip helper only when all mapped failed criteria are `confidence: "high"` and pass deterministically; otherwise invoke helper.
- For proxy rules (builds_successfully, boilerplate heuristics), force helper to run (confidence medium).

6) Prompt nudge (helper)
- Keep directive: "If not 100% certain, generate verification commands. Prefer commands over returning isValid=true without commands." Ensure present in helper prompt template.

## Tests
- Unit: deterministic validator enforces caps; regex rejection heuristics; semver match; ripgrep fallback toggles; cache-rate calculation.
- Control loop: flag off/on, percent bucket respected; high-confidence pass skips helper; medium-confidence forces helper; cache-rate logged when usage present.
- Analytics: skip-rate and helper latency stats persisted; summary emitted at finalize.

## Rollout
- Stage: enable deterministic at 25%, collect metrics for skip rate, helper avg/P95, cache-hit. Abort if retries increase >10% or task success drops.
- Ramp: 25% → 50% → 100% over 2-3 days if metrics stable or improved.
- Rollback: set `HELPER_DETERMINISTIC_ENABLED=false` to disable; keep logging.

## Acceptance Criteria
- Helper skip decisions only on high-confidence rules; medium rules do not skip.
- Deterministic scans respect file/byte caps; no regex-induced slowdowns.
- Metrics include skip rate, helper avg/P95 duration, cache-hit rate; summaries emitted.
- Helper prompt bias reduced (commands preferred when uncertain).

## Open Questions
- Should helper cache-hit metrics also drive auto-tuning (e.g., increase deterministic percent when cache-hit low)?
- Do we need per-project dashboards, or is JSONL export sufficient?
- Should ripgrep be a hard dependency in CI for deterministic paths?
