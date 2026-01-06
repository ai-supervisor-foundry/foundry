# Helper Agent Optimization — Remediation & Hardening Plan

Status: Actionable Fixes  
Scope: Deterministic pre-validation, helper sessions, metrics, safety  
Date: 2026-01-06

---

## Objective

Align the implementation with the original Helper Agent Optimization plan while addressing gaps identified during code review. Focus on safety (false positive control), performance (I/O bounds), observability (metrics), and rollout (feature flags / A/B).

---

## Quick Wins (Day 0)

1) Add missing runtime dependency
- Issue: `glob` is used in `deterministicValidator` but not declared.
- Change:
  - package.json → dependencies: add `"glob": "^10.3.10"`
  - Avoid devDependency; this runs at runtime.

2) Feature flags + A/B rollout
- ENV:
  - `HELPER_DETERMINISTIC_ENABLED=true|false` (default: true)
  - `HELPER_DETERMINISTIC_PERCENT=100` (0-100 gate)
  - `HELPER_DETERMINISTIC_MAX_FILES=2000` (cap for scans)
  - `HELPER_DETERMINISTIC_MAX_BYTES=10485760` (10MB overall read cap)
- Control:
  - Gate deterministic path in `controlLoop.ts` before invoking helper.

3) Prompt nudge to reduce zero-command validations
- Goal: Prefer commands unless 100% certain.
- Update `buildEnhancedHelperAgentPrompt()` language:
  - “If not 100% certain, generate verification commands. Avoid returning `isValid:true` without commands unless trivial (pure existence checks).”

---

## Performance Hardening (I/O & Regex)

4) Bound directory scans and file reads
- `deterministicValidator.ts`:
  - In `grepContent()` and recursive scans:
    - Only include files with extensions: `.{ts,tsx,js,jsx,json,md}`
    - Skip files > `HELPER_DETERMINISTIC_MAX_BYTES_PER_FILE` (default 512KB)
    - Global cap: stop after reading `HELPER_DETERMINISTIC_MAX_FILES` files or `HELPER_DETERMINISTIC_MAX_BYTES` bytes.
  - Prefer `glob` patterns narrowed by `rules` (e.g., `src/**/*.{ts,tsx}`) over full-tree.

5) Regex safety and compilation
- Compile regex once per rule; catch `SyntaxError` and treat as non-match.
- Disallow catastrophic patterns by rejecting nested quantifiers like `(.*)*` or backtracking-heavy constructs; simple heuristic check.
- Use case-insensitive flag only (`/i`) and anchor where possible.

6) Prefer shell tools when available (optional)
- If `rg` (ripgrep) is on PATH and `USE_RIPGREP=true`, call it for `grep_*` checks with `--max-filesize` and `--hidden -uu` options respecting caps. Fallback to Node scan.

---

## Correctness Hardening

7) Semver checks for JSON
- Issue: pseudo-semver `~` is treated as mere presence.
- Fix:
  - Add `semver` dependency.
  - Extend `jsonContains()` to support `{ pattern: "dependencies.expo", value: "~54.0.0", match: "semver" }` and evaluate `semver.satisfies(current, value)`.
  - Backward compatible: if `match!=='semver'`, preserve exact match.

8) Deterministic rules coverage & confidence
- Strengthen rules with explicit certainty tiers:
  - `high`: pure file existence, JSON key presence, capped file counts.
  - `medium`: pattern searches, heuristics (e.g., boilerplate scan).
- Only skip helper when ALL failed criteria map to `high` checks and pass.
- If any criterion maps to `medium`, do not skip; generate helper commands.

9) False-positive guard
- For cases like “builds successfully,” keep as proxy-only (do not skip). Mark as `medium` confidence automatically.
- Log a clear reason when not skipping due to confidence levels.

---

## Session & Metrics Enhancements

10) Session cache-hit visibility
- When provider returns usage stats (e.g., `{ tokens: { cached } }`), compute cache-hit rate.
- Log: `HelperSession cache rate: ${cached/total*100}%` and aggregate in analytics.

11) Aggregate metrics & periodic summaries
- Extend `analyticsService`:
  - Track: `deterministic_attempts`, `deterministic_success`, `helper_invocations`, `helper_duration_ms_total`.
  - Provide `logSummary()` every N iterations or on task finalize with:
    - Deterministic skip rate = success/attempts
    - Avg/P95 helper duration
- Persist in `metrics.jsonl` (already exists) with new fields.

12) Feature-level counters (optional)
- Track by `feature_id` (`helper:validation:${projectId}`) to see project-level trends.

---

## Code Change Checklist (Exact Edits)

- package.json
  - Add deps: `glob`, `semver`. If using ripgrep, none needed.

- src/application/services/controlLoop.ts
  - Gate deterministic validation block with flags:
    ```ts
    const detEnabled = process.env.HELPER_DETERMINISTIC_ENABLED !== 'false';
    const detPercent = Math.max(0, Math.min(100, parseInt(process.env.HELPER_DETERMINISTIC_PERCENT || '100', 10)));
    const inBucket = (Math.random() * 100) < detPercent;
    if (detEnabled && inBucket) {
      // attemptDeterministicValidation(...)
    } else {
      log('[Deterministic] Skipped by flag/percent');
    }
    ```
  - After helper execution, compute cache-rate when available and call `analyticsService.recordHelperAgent(...)` with duration; add `analyticsService.logSummary(task.task_id)` periodically.

- src/application/services/deterministicValidator.ts
  - Add caps and extension filters to `grepContent()` and `glob()` usage.
  - Add total-bytes tracking and bail early on caps.
  - Compile regex safely with try/catch, pre-check for pathological patterns.
  - Extend `jsonContains()` to support `match: 'semver'` using `semver.satisfies()`.

- src/config/deterministicValidationRules.ts
  - Annotate each rule with `confidence: 'high' | 'medium'` and ensure skip logic only fires when all are `high`.
  - Use narrower glob patterns where possible.

- src/domain/executors/commandGenerator.ts
  - Update prompt copy:
    - Add: “If not 100% certain, generate verification commands. Prefer commands over returning isValid=true without commands.”
  - Optionally surface `featureId` and `sessionId` in logs.

- src/infrastructure/connectors/agents/providers/geminiCLI.ts
  - Verify `ProviderResult` type import points to central `types` (not haltDetection); fix if necessary.

- src/application/services/analytics.ts
  - Add counters for deterministic attempts/success and helper durations; include in `finalizeTask()` payload.

---

## Tests

Unit tests
- deterministicValidator
  - Caps enforced (files, bytes) → no unbounded scanning
  - `jsonContains()` semver mode correctness
  - Regex compile failures are handled (return false)
- rules
  - confidence tiers respected; skip only when all `high`
- analytics
  - Skip-rate computed correctly; persisted on finalize

Integration tests
- controlLoop
  - Flag off → helper always runs
  - 10% bucket → deterministic invoked for ~10% calls
  - Deterministic pass (all high) → helper skipped
  - Deterministic inconclusive → helper invoked
- commandGenerator prompt
  - Preference for commands reflected in behavior (returns commands when uncertain)

---

## Rollout Plan

1) Stage
- Enable with `HELPER_DETERMINISTIC_ENABLED=true`, `HELPER_DETERMINISTIC_PERCENT=25`.
- Watch metrics: skip-rate, helper avg duration, retries.

2) Ramp
- 25% → 50% → 100% over 2-3 days, contingent on:
  - No increase in retry rate (>10%)
  - Task success rate ≥ baseline
  - Latency down ≥ 30%

3) Rollback
- Toggle `HELPER_DETERMINISTIC_ENABLED=false` to disable immediately.

---

## Acceptance Criteria

- No uncontrolled deep scans; deterministic checks stay <1s for typical projects, <3s worst-case.
- Helper skip-rate ≥ 40% without increased retries.
- Aggregate metrics present: skip-rate, helper avg/P95 duration, token cache-rate for helper sessions.
- Zero JSON parse or prompt contract regressions.

---

## Follow-ups (Optional)

- Rule auto-learning: capture helper commands for failing deterministic cases and propose new rules.
- Ripgrep/fd integration for faster scans.
- Minimal in-process LLM classifier to map criteria→rules when unmapped (future work).
