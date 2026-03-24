# 11b — Performance Gates & Observability

## Source Files
- `.github/workflows/bench.yml` — Benchmark CI with regression gates
- `tests/regression/performance_gates.rs` — Threshold tests
- `benches/README.md` — Performance targets
- `docs/compliance/nist_ai_rmf.md` — NIST mapping

## Performance Gate Tests

Tests that fail CI if performance degrades beyond thresholds:

```typescript
// tests/perf/performance-gates.test.ts
// Only run when PERF_GATES env var is set

describe.skipIf(!process.env.PERF_GATES)('Performance Gates', () => {
  test('config parse < 1ms', () => { /* benchmark, assert */ });
  test('JSON event serialize < 5µs', () => { /* ... */ });
  test('SHA-256 of 1MB < 5ms', () => { /* ... */ });
  test('100 hook regex matches < 1ms', () => { /* ... */ });
  test('session snapshot (50 files) < 500ms', () => { /* ... */ });
});
```

## Benchmark CI with PR Comments

```yaml
- uses: benchmark-action/github-action-benchmark@v1
  with:
    tool: 'customSmallerIsBetter'
    output-file-path: benchmark-results.json
    alert-threshold: '150%'          # fail if 1.5x regression
    comment-on-alert: true
    fail-on-alert: true
```

Skip Dependabot: `if: github.actor != 'dependabot[bot]'`
Concurrency: `cancel-in-progress: true`

## Benchmark Targets

| Subsystem | TS Target |
|-----------|-----------|
| Config parse | <1 ms |
| Checkpoint write (200k tokens) | <200 ms |
| Hook match (100 hooks) | <1 ms |
| Snapshot (50 files) | <500 ms |
| Agent spawn overhead | <10 ms |

## Observability Stack

- **Cost tracking** — `totalInputTokens`, `totalOutputTokens`, `totalCostUsd`
  per session, updated on every API call
- **Latency histograms** — p50/p90/p99 per provider
- **RSS memory monitor** — high water mark tracking
- **Idle detection** — detect when agent loops without progress

## OWASP LLM Top 10 Compliance

| Risk | Status | Mitigation |
|------|--------|-----------|
| LLM01 Prompt Injection | Implement | XML delimiters, jailbreak scan |
| LLM02 Insecure Output | Implement | Scan before shell execution |
| LLM04 Model DoS | Implement | AbortController, token budget |
| LLM05 Supply Chain | Implement | Nightly audit CI |
| LLM06 Sensitive Info | Implement | OS keyring, redaction |
| LLM07 Insecure Plugin | Implement | Integrity hash verification |
| LLM08 Excessive Agency | Implement | Approval modes per tool |

## NIST AI RMF "Lethal Trifecta"

Evaluate before sensitive actions:
1. **Access to Data** — can the agent read secrets/credentials?
2. **Untrusted Content** — is external/user input in context?
3. **Exfiltration Vector** — can the agent send data outbound?

All three present → require human approval.

## Acceptance Criteria

- [ ] Performance gate tests with configurable thresholds
- [ ] Benchmark CI with PR regression comments (150% threshold)
- [ ] Per-session cost/token tracking
- [ ] Latency histograms per provider
- [ ] OWASP compliance documented and implemented
