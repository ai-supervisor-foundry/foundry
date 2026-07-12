# Observability — COMPLETED

**Status:** Session metrics implemented (2026-06)

Implemented:
- `SessionMetricsCollector` in `src/infrastructure/monitoring/sessionMetrics.ts`
- Control loop hooks in `taskExecutor` + periodic logging every 10 iterations
- CLI `metrics` command shows Session Health from `session-metrics.json`
- Unit tests in `tests/unit/infrastructure/sessionMetrics.test.ts`

Validation:
- Grep logs for `[Metrics] Session Reuse Rate`
- Run `npm run cli -- metrics` after control loop activity
- Check `{sandboxRoot}/{projectId}/session-metrics.json`
