# Runbook

## Core Workflow
1. **Initialize**: `npm run cli -- init-state`
2. **Configure Goal**: `npm run cli -- set-goal --description "..." --project-id my-project`
3. **Enqueue Tasks**: `npm run cli -- enqueue --task-file tasks.json`
4. **Execute**: `npm run cli -- start`
5. **Monitor**: `npm run cli -- status` or view the [Supervisor UI Dashboard](../UI/README.md)

---

## Detailed Configuration Reference

Foundry is configured primarily via environment variables. These should be set in a `.env` file in the project root.

### Redis & State Persistence
State is externalized to DragonflyDB/Redis to ensure work can continue across restarts.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `REDIS_HOST` | `localhost` | Host for the Redis instance. |
| `REDIS_PORT` | `6499` | Port for the Redis instance. |
| `STATE_KEY` | `supervisor:state` | The specific key in Redis holding the project snapshot. |
| `QUEUE_NAME` | `tasks` | Name of the FIFO task queue. |

### AI Provider CLI Overrides
If your provider CLIs are not in the system `PATH` or require specific binary paths (e.g., Cursor on Linux), use these variables:

| Variable | Default |
| :--- | :--- |
| `GEMINI_CLI_PATH` | `gemini` or `npx` |
| `COPILOT_CLI_PATH` | `npx` |
| `CURSOR_CLI_PATH` | `cursor` |
| `CLI_PROVIDER_PRIORITY` | `copilot,gemini,ollama` (example fallback order) |

### Validation Tuning
Foundry uses a "Local-First" validation strategy to reduce costs.

| Variable | Default | Impact |
| :--- | :--- | :--- |
| `HELPER_DETERMINISTIC_ENABLED` | `true` | When `true`, runs local regex and structural checks before calling an LLM. |
| `HELPER_DETERMINISTIC_PERCENT` | `100` | Sampling rate. Set lower to skip local checks for speed. |
| `USE_LOCAL_HELPER_AGENT` | `true` | If `true`, uses a local Ollama instance for command generation instead of Gemini/Claude. |
| `LOCAL_HELPER_MODEL` | `phi4-mini` | The Ollama model to use for validation tasks. |

---

## Troubleshooting & Reference

### Common Error Scenarios

#### 1. Logical Loops
**Symptom**: The same task repeats infinitely even if it claims "success".
**Cause**: The Supervisor is crashing *after* execution but *before* state persistence.
**Solution**: Check `pm2 logs supervisor` for "TypeError" or path errors. Verify your `.env` has a valid `SANDBOX_ROOT`.

#### 2. Agent/Provider Hangs
**Symptom**: PM2 shows "Spawning process..." but no prompt log is created.
**Cause**: The CLI is waiting for interactive input (e.g., "Allow Copilot to use tool?").
**Solution**: Ensure `stdin.end()` is implemented in the provider connector. Check `scripts/investigations/provider-health.ts`.

#### 3. State Key Not Found
**Symptom**: `Supervisor error: State key supervisor:state not found`.
**Cause**: Redis was restarted or the key was deleted.
**Solution**: Re-run `npm run cli -- init-state`.

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