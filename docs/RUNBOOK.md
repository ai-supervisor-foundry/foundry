# Runbook

- Start session (load PROMPT.md & rules).
- Inject explicit goal.
- Execute control loop (tasks dispatched via Agents/Providers: Gemini, Copilot, Cursor).
- Review outputs/diffs.
- Persist state.
- Stop execution.


## Troubleshooting & Reference

### Behavioral Tasks
- If validation fails despite correct response, check if `task_type` is set to `"behavioral"`.
- See [BEHAVIORAL_TASKS_GUIDE.md](./BEHAVIORAL_TASKS_GUIDE.md) for pattern matching rules.

### AST Validation
- If structural checks (classes, methods) fail incorrectly, verify file paths in `required_artifacts`.
- See [AST_VALIDATION_GUIDE.md](./AST_VALIDATION_GUIDE.md) for supported languages.

### Quick Reference: Limits
| Limit | Value | Description |
|-------|-------|-------------|
| Default Retries | 1 | Standard tasks (configurable in `retry_policy`) |
| Resource Retries | 0 | Infrastructure failures (no automatic retries) |
| Initial Interrogation | 1 round | Max 1 clarifying question per criterion |
| Final Interrogation | 0 rounds | Final check before blocking (disabled) |
| Deterministic helper skip | Flagged via `HELPER_DETERMINISTIC_ENABLED` / `HELPER_DETERMINISTIC_PERCENT` |
| Session reuse | Disable via `DISABLE_SESSION_REUSE`; per-provider context caps apply |

---

## Diagnostics & Investigation Scripts

When troubleshooting system issues, use the [Investigation Scripts](../scripts/investigations/README.md) toolkit:

### Common Issues & Solutions

| Issue | Script | Command |
|-------|--------|---------|
| **System uses wrong provider** | `provider-health.ts` | `npx ts-node scripts/investigations/provider-health.ts` |
| **Tasks stuck in queue** | `task-queue-inspect.ts` | `npx ts-node scripts/investigations/task-queue-inspect.ts` |
| **High failure rate / error patterns** | `log-analyzer.ts` | `npx ts-node scripts/investigations/log-analyzer.ts --failures` |
| **Need to clear circuit breaker** | `provider-health.ts` | `npx ts-node scripts/investigations/provider-health.ts --clear <provider>` |
| **Monitor queue size** | `task-queue-inspect.ts` | `npx ts-node scripts/investigations/task-queue-inspect.ts --json` |
| **Check provider priority** | `provider-health.ts` | `npx ts-node scripts/investigations/provider-health.ts` |

### Quick Start

```bash
# Full system health check
npx ts-node scripts/investigations/provider-health.ts

# Check task queue state
npx ts-node scripts/investigations/task-queue-inspect.ts

# Analyze execution logs
npx ts-node scripts/investigations/log-analyzer.ts --summary

# For detailed usage and examples, see
cat scripts/investigations/README.md
```

### Investigation Script Architecture

- **schema.ts** - Shared TypeScript interfaces (CircuitBreakerStatus, TaskStateInfo, etc.) and utilities
- **provider-health.ts** - Diagnose provider availability and circuit breaker status
- **task-queue-inspect.ts** - Inspect task queue state, blocked/failed tasks, retry status
- **log-analyzer.ts** - Analyze execution logs for patterns and provider usage

All scripts support `--json` flag for automation and CI/CD integration. See [Investigation Scripts README](../scripts/investigations/README.md) for complete documentation, troubleshooting matrix, and examples.

---

## Performance Metrics

To view aggregated performance data for the current project:

```bash
npm run cli -- metrics \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --queue-name tasks \
  --queue-db 2
```

This displays:
- **Success Rate**: Ratio of completed vs failed/blocked tasks.
- **Average Iterations**: How many retries/fixes tasks usually require.
- **Execution Time**: Total time spent in the control loop.
- **Bottlenecks**: Total character counts for token usage estimation.
- **Slowest Task**: Identifies the most complex task in the sequence.
- **Helper/Cache**: Helper avg/p95 duration and cache hit rate (if available).

