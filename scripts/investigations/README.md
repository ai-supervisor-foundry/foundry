# Investigation Scripts

Reusable diagnostic tools for troubleshooting supervisor system issues, provider fallbacks, task queue states, and execution failures.

## Quick Start

All scripts require Node.js and TypeScript. Run scripts with:

```bash
npx ts-node scripts/investigations/<script-name>.ts [options]
```

## Scripts

### 1. Provider Health Diagnostics (`provider-health.ts`)

**Purpose**: Diagnose why a specific provider is/isn't being used. Shows priority order, active circuit breakers, and recovery timeline.

**When to Use**:
- System is using wrong provider (e.g., Copilot instead of Gemini)
- Need to understand provider fallback chain
- Want to see why a provider is disabled

**Example Usage**:
```bash
# Full health report with priority order and active breakers
npx ts-node scripts/investigations/provider-health.ts

# Show only active circuit breakers
npx ts-node scripts/investigations/provider-health.ts --only-breakers

# Check specific provider
npx ts-node scripts/investigations/provider-health.ts --provider gemini

# Clear a circuit breaker (use with caution!)
npx ts-node scripts/investigations/provider-health.ts --clear gemini

# JSON output for parsing
npx ts-node scripts/investigations/provider-health.ts --json
```

**Sample Output**:
```
╔════════════════════════════════════════════════════════════════╗
║                    PROVIDER HEALTH REPORT                      ║
╚════════════════════════════════════════════════════════════════╝

📋 Provider Priority Order:

  1. gemini          [🔴 CIRCUIT-BROKEN: unknown_error]
  2. copilot         [🟢 AVAILABLE]
  3. cursor          [🟢 AVAILABLE]
  4. codex           [🟢 AVAILABLE]
  5. claude          [🟢 AVAILABLE]
  6. gemini_stub     [🟢 AVAILABLE]

🔌 Active Circuit Breakers (1):

  🔴 gemini (unknown_error)
    Triggered: 2026-01-03 07:27:10 UTC
    Expires: 2026-01-04 07:27:10 UTC
    Time Remaining: 15h 45m 32s
    Action: Wait or use --clear gemini to reset
```

**Flags**:
- `--redis-host <host>` - DragonflyDB host (default: localhost)
- `--redis-port <port>` - DragonflyDB port (default: 6499)
- `--provider <name>` - Check specific provider only
- `--only-breakers` - Show only active circuit breakers (hide available providers)
- `--clear <provider>` - Clear circuit breaker and reset provider (requires confirmation)
- `--json` - Output JSON format for automation

---

### 2. Task Queue Inspector (`task-queue-inspect.ts`)

**Purpose**: Diagnose task queue state, identify stuck/blocked/failed tasks, and monitor retry status.

**When to Use**:
- Tasks are stuck in queue
- Want to see which tasks are blocked or failed
- Need to understand task state and retry attempts
- System appears to be hung or not processing tasks

**Example Usage**:
```bash
# Full queue status report
npx ts-node scripts/investigations/task-queue-inspect.ts

# Show only blocked tasks
npx ts-node scripts/investigations/task-queue-inspect.ts --filter blocked

# Show specific task details
npx ts-node scripts/investigations/task-queue-inspect.ts --task-id abc-123-def

# Limit output to 10 tasks
npx ts-node scripts/investigations/task-queue-inspect.ts --limit 10

# JSON output
npx ts-node scripts/investigations/task-queue-inspect.ts --json
```

**Sample Output**:
```
╔════════════════════════════════════════════════════════════════╗
║                    TASK QUEUE INSPECTION                       ║
╚════════════════════════════════════════════════════════════════╝

⚙️  Currently Executing:

  📌 Task: task-2024-001
  Started: 2026-01-03 12:30:45 UTC
  Elapsed: 234s

📋 Task Queue:

  Total queued: 5 task(s)
  Showing: 5/5

    1. task-2024-002
    2. task-2024-003
    3. task-2024-004
    4. task-2024-005
    5. task-2024-006

🔒 Blocked Tasks (2):

  1. task-2024-007
     Reason: provider_circuit_broken
     Blocked: 2026-01-03 10:15:22 UTC
     Retry Attempts: 3

  2. task-2024-008
     Reason: max_interrogations_exceeded
     Blocked: 2026-01-03 09:45:00 UTC
     Retry Attempts: 1

❌ Failed Tasks (1):

  1. task-2024-009
     Reason: max_retries_exceeded
     Error: Provider returned 500 error
     Failed: 2026-01-03 08:30:15 UTC
     Retry Attempts: 1

📊 Summary:

  Total Queued: 5
  Total Blocked: 2
  Total Failed: 1
  Currently Executing: 1

💡 Recommendations:

  ⚠️  2 task(s) are blocked. Check reasons above.
  ⚠️  1 task(s) have failed. Consider running: npm run unblock-tasks
```

**Flags**:
- `--redis-host <host>` - DragonflyDB host (default: localhost)
- `--redis-port <port>` - DragonflyDB port (default: 6499)
- `--filter <type>` - Show only: queued | blocked | failed
- `--task-id <id>` - Show details for specific task
- `--limit <number>` - Max tasks to show (default: 20)
- `--json` - Output JSON format

---

### 3. Log Analyzer (`log-analyzer.ts`)

**Purpose**: Extract and analyze execution logs to identify patterns, failures, and provider usage statistics.

**When to Use**:
- Need to understand which providers are failing most
- Want to see error patterns and frequency
- Need to verify provider usage distribution
- Debugging specific task execution history

**Example Usage**:
```bash
# Full log analysis with statistics
npx ts-node scripts/investigations/log-analyzer.ts

# Show only failed executions
npx ts-node scripts/investigations/log-analyzer.ts --failures --limit 20

# Analyze specific task's execution history
npx ts-node scripts/investigations/log-analyzer.ts --task task-2024-001

# Show exit code breakdown
npx ts-node scripts/investigations/log-analyzer.ts --exit-codes

# Provider usage statistics only
npx ts-node scripts/investigations/log-analyzer.ts --providers

# JSON output
npx ts-node scripts/investigations/log-analyzer.ts --summary --json
```

**Sample Output**:
```
╔════════════════════════════════════════════════════════════════╗
║                      LOG ANALYZER REPORT                        ║
╚════════════════════════════════════════════════════════════════╝

📊 Execution Statistics:

  Total Entries: 1,247
  Successful: 1,189 (95.3%)
  Failed: 58 (4.7%)
  Date Range: 2026-01-02 10:30:15 UTC → 2026-01-03 15:45:22 UTC

🔌 Provider Usage:

  gemini            :    0 (0.0%)
  copilot           :  743 (59.5%)
  cursor            :  412 (33.0%)
  codex             :   64 (5.1%)
  claude            :   28 (2.2%)
  gemini_stub       :    0 (0.0%)

🚪 Exit Codes:

  ✅ Exit   0: 1189 executions
  ❌ Exit   1:   32 executions
  ❌ Exit 124:   26 executions

⚠️  Error Patterns:

  timeout                        :   26 (44.8% of failures)
  provider_circuit_broken        :   18 (31.0% of failures)
  max_retries_exceeded           :    8 (13.8% of failures)
  authentication_error           :    6 (10.3% of failures)

📝 Recent Entries (showing 50/1247):

  ✅ 2026-01-03 15:45:22
     Task: task-2024-001
     Provider: copilot
     Status: Success [2.3s] [45.2MB]

  ❌ 2026-01-03 15:44:15
     Task: task-2024-002
     Provider: copilot
     Error: timeout [15.0s] [128.5MB]

  ✅ 2026-01-03 15:43:10
     Task: task-2024-003
     Provider: cursor
     Status: Success [1.8s] [32.1MB]
```

**Flags**:
- `--log-file <path>` - Path to prompts.log.jsonl (default: prompts.log.jsonl)
- `--summary` - Show aggregate statistics only (skip recent entries)
- `--failures` - Show only failed executions
- `--task <id>` - Filter by specific task ID
- `--limit <number>` - Max entries to show (default: 50)
- `--exit-codes` - Group by exit code
- `--providers` - Show provider usage breakdown
- `--json` - Output JSON format

---

## Troubleshooting Matrix

| Problem | Root Cause | Investigation | Solution |
|---------|-----------|---------------|----------|
| **System uses wrong provider** | Circuit breaker active on preferred provider | `provider-health.ts` | Clear breaker or fix underlying issue (auth, API status) |
| **Tasks stuck in queue** | Queue processing hung or blocked | `task-queue-inspect.ts` | Check current task, unblock blocked tasks, restart if needed |
| **High failure rate** | Specific provider or error pattern | `log-analyzer.ts --failures` | Identify pattern, check provider status, adjust priority |
| **One provider never used** | Always circuit-broken or lower priority | `provider-health.ts --provider X` | Check if breaker active, verify credentials, check logs |
| **Memory growing** | Memory leak in provider or logging | `log-analyzer.ts` + `task-queue-inspect.ts` | Check memory_used_bytes in logs, identify leaky task patterns |
| **Frequent timeouts** | Provider slow, network issues, or high load | `log-analyzer.ts --failures` | Check provider status, review load patterns |
| **All providers blocked** | Cascading failures or misconfiguration | `provider-health.ts` | Critical! All providers down. Check system logs, restart providers |

---

## Configuration

All scripts support these environment variables or CLI flags:

### Redis Connection
```bash
export DRAGONFLY_HOST=localhost
export DRAGONFLY_PORT=6499
export DRAGONFLY_DB=0

# Or use flags
npx ts-node scripts/investigations/provider-health.ts --redis-host localhost --redis-port 6499
```

### Log File Location
```bash
export LOG_FILE=/path/to/prompts.log.jsonl

# Or use flag
npx ts-node scripts/investigations/log-analyzer.ts --log-file /path/to/prompts.log.jsonl
```

---

## Integration with CI/CD

These scripts can be integrated into monitoring and alerting pipelines:

```bash
# Health check in deployment verification
npx ts-node scripts/investigations/provider-health.ts --json | jq '.circuit_breakers | length > 0'

# Monitor queue size in cron job
QUEUE_SIZE=$(npx ts-node scripts/investigations/task-queue-inspect.ts --json | jq '.queue.total_length')
if [ "$QUEUE_SIZE" -gt 100 ]; then echo "ALERT: Queue too large"; fi

# Analyze failure rates after deployments
npx ts-node scripts/investigations/log-analyzer.ts --summary --json | jq '.statistics.failed'
```

---

## Design Patterns

### Shared Types (`schema.ts`)

All scripts use shared TypeScript interfaces for type safety:

```typescript
// From schema.ts
interface CircuitBreakerStatus {
  provider: string;
  triggered_at: string;
  expires_at: string;
  error_type: string;
}

interface TaskStateInfo {
  task_id: string;
  blocked_reason?: string;
  retry_count: number;
}

interface ExecutionLogEntry {
  timestamp: string;
  task_id: string;
  provider: string;
  exit_code: number;
  error_type?: string;
}
```

### Common Utilities

- `calculateTimeRemaining()` - Parse ISO timestamps and calculate remaining time
- `formatTimestamp()` - Format ISO strings to human-readable format
- `getStatusEmoji()` - Return emoji based on status (🟢/🔴/⏳)

---

## Script Development

To add new investigation scripts:

1. Create `scripts/investigations/my-script.ts`
2. Import types from `./schema.ts`
3. Use Commander.js for CLI parsing
4. Follow redis client cleanup pattern (use `finally` for quit)
5. Support both human-readable and `--json` output

Example template:

```typescript
#!/usr/bin/env npx ts-node
import { Command } from 'commander';
import Redis from 'ioredis';
import { formatTimestamp, getStatusEmoji } from './schema';

const program = new Command();
program.option('--redis-host <host>', 'DragonflyDB host', 'localhost');

const options = program.opts();
const client = new Redis({
  host: options.redisHost,
  port: 6499,
  db: 0,
});

try {
  // Your investigation logic here
} finally {
  await client.quit();
}
```

---

## Performance Notes

- `provider-health.ts`: Fast (O(1) circuit breaker lookups)
- `task-queue-inspect.ts`: Medium (O(n) where n = queue size, typically < 100)
- `log-analyzer.ts`: Slower (O(n) file read where n = log lines, can be 10k+)

For large log files (> 100MB), consider using `--task-id` or `--failures` filters to reduce data processed.

---

## References

- [Circuit Breaker System](../docs/ARCHITECTURE.md#circuit-breaker)
- [Task Queue Design](../docs/QUEUE_SYSTEM.md)
- [Supervisor Architecture](../docs/ARCHITECTURE_DETAILED.md)
- [Runbook & Troubleshooting](../docs/RUNBOOK.md)
