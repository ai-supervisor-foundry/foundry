# Investigation Scripts - Implementation Proposal

## Overview
Create reusable TypeScript diagnostic scripts for investigating supervisor system issues, particularly around provider health, circuit breakers, task queue, and execution logs.

## Rationale
- **Current State**: Scripts exist (dump-state.ts, check-goal.ts) but no systematic investigation toolkit
- **Gap**: Circuit breaker debugging required multiple manual redis-cli + jq commands
- **Pattern Match**: Found reusable commands (60%) across investigation workflows
- **Choice**: TypeScript (matches existing scripts/\*.ts, uses Redis client, better type safety)

---

## Proposed Structure

```
scripts/investigations/
├── README.md (master guide + troubleshooting matrix)
├── provider-health.ts (main script)
├── task-queue-inspect.ts (queue/task diagnostics)
├── log-analyzer.ts (prompts.log.jsonl extraction)
└── schema.ts (shared types)
```

### Why Single "Provider Health" + "Task Queue" Combo?
- **Avoids Script Explosion**: 6+ tiny scripts → 2 focused scripts
- **Logical Grouping**: Provider issues → health.ts; Task issues → queue.ts; Logs → analyzer.ts
- **Flexible**: Each can be run independently or as part of full diagnostic
- **Easier Maintenance**: Fewer files to update

---

## Script 1: `provider-health.ts`

**Purpose**: Diagnose provider availability, circuit breaker status, and priority order

**Responsibilities**:
1. Display provider priority order (from code + env var)
2. List all active circuit breakers (with error type, expiry)
3. Calculate time until provider recovery
4. Show recommended actions

**Usage Examples**:
```bash
# Full diagnostic
npx ts-node scripts/investigations/provider-health.ts

# Check specific provider
npx ts-node scripts/investigations/provider-health.ts --provider gemini

# Clear circuit breaker (with confirmation)
npx ts-node scripts/investigations/provider-health.ts --clear gemini

# Show only circuit breakers
npx ts-node scripts/investigations/provider-health.ts --only-breakers
```

**Output Format**:
```
╔════════════════════════════════════════════════════════════════╗
║                    PROVIDER HEALTH REPORT                      ║
╚════════════════════════════════════════════════════════════════╝

📋 Provider Priority Order:
  1. gemini          [🔴 CIRCUIT-BROKEN: authentication]
  2. copilot         [🟢 AVAILABLE]
  3. cursor          [🟢 AVAILABLE]
  4. codex           [⚪ UNKNOWN (no breaker)]
  5. claude          [🟢 AVAILABLE]
  6. gemini-stub     [🟢 AVAILABLE]

🔌 Active Circuit Breakers (2):
  • gemini (authentication)
    Triggered: 2026-01-03T07:27:10.225Z
    Expires: 2026-01-04T07:27:10.225Z (in 16h 24m)
    TTL: 86400s
    Action: Wait or use --clear gemini to reset

  • cursor (resource_exhausted)
    Triggered: 2026-01-02T12:00:00.000Z
    Expires: 2026-01-03T12:00:00.000Z (EXPIRED - ready to use)
    TTL: 86400s
    Action: Already expired, will be cleared on next auto-check

⚙️ Configuration:
  - Redis: localhost:6499 (DB: 0)
  - State Key: supervisor:state
  - TTL Strategy: 24 hours per breach

💡 Recommendations:
  ✓ Gemini is circuit-broken. Next provider (Copilot) will be used.
  ✓ Circuit breaker expires in 16h 24m. Check Gemini API status.
  ⚠️  Do NOT manually clear breaker unless root cause is resolved.
```

**Implementation Notes**:
- Fetch all `circuit_breaker:*` keys from Redis
- Parse CircuitBreakerStatus JSON
- Calculate TTL remaining
- Show priority order from CLIAdapter logic
- Support --clear flag with confirmation prompt

---

## Script 2: `task-queue-inspect.ts`

**Purpose**: Diagnose task queue state, blocked tasks, and retry status

**Responsibilities**:
1. Show queue length and next task
2. List blocked/failed tasks
3. Show retry attempts per task
4. Identify stuck tasks (high iteration count, low progress)

**Usage Examples**:
```bash
# Full queue diagnostic
npx ts-node scripts/investigations/task-queue-inspect.ts

# Show only blocked tasks
npx ts-node scripts/investigations/task-queue-inspect.ts --filter blocked

# Show task by ID
npx ts-node scripts/investigations/task-queue-inspect.ts --task-id testing-0091

# Unblock specific task (with confirmation)
npx ts-node scripts/investigations/task-queue-inspect.ts --unblock testing-0091
```

**Output Format**:
```
╔════════════════════════════════════════════════════════════════╗
║                      TASK QUEUE REPORT                         ║
╚════════════════════════════════════════════════════════════════╝

📊 Queue Status:
  Total Queued: 0 tasks
  Total Blocked: 2 tasks
  Total Failed: 1 task
  Current Task: None

🚫 Blocked Tasks (2):
  1. testing-0091
     Status: BLOCKED (repeated_errors)
     Iterations: 87
     Retry Count: 1/1
     Last Error: invalid model argument 'gemini-2.5-flash-lite'
     Error Type: CLI_ERROR
     Blocked Since: 2026-01-03T07:27:13Z (8 hours ago)
     Action: Fix model name, then --unblock testing-0091

  2. task-1767424712318
     Status: BLOCKED (max_retries_exceeded)
     Iterations: 4
     Retry Count: 1/1
     Last Error: authentication failed
     Blocked Since: 2026-01-03T07:22:14Z (8 hours ago)
     Action: Check credentials or provider health

⏱️  Retry Status:
  No pending retries
  (All tasks are either blocked or waiting for queue)

💡 Recommendations:
  ✓ testing-0091: Invalid model name. Check TASK_SCHEMA.json for valid options.
  ✓ task-1767424712318: Provider auth failed. See `provider-health.ts` for circuit breaker status.
```

**Implementation Notes**:
- Load supervisor state from Redis
- Parse queue, blocked_tasks, failed_tasks arrays
- Calculate time durations
- Identify patterns (high iterations = stuck)
- Support filtering/targeting specific tasks

---

## Script 3: `log-analyzer.ts`

**Purpose**: Extract and analyze execution logs (prompts.log.jsonl)

**Responsibilities**:
1. Extract provider usage statistics
2. Find recent errors by type
3. Show execution timeline for specific task
4. Identify patterns (e.g., all executions failing with same error)

**Usage Examples**:
```bash
# Provider usage summary
npx ts-node scripts/investigations/log-analyzer.ts --summary

# Show recent failures
npx ts-node scripts/investigations/log-analyzer.ts --failures --limit 10

# Task execution timeline
npx ts-node scripts/investigations/log-analyzer.ts --task testing-0091

# Count exit codes
npx ts-node scripts/investigations/log-analyzer.ts --exit-codes
```

**Output Format**:
```
╔════════════════════════════════════════════════════════════════╗
║                    EXECUTION LOG ANALYSIS                      ║
╚════════════════════════════════════════════════════════════════╝

📈 Provider Usage Summary:
  copilot:      2 executions (100% success rate)
  gemini:       0 executions (circuit-broken before execution)
  cursor:       0 executions
  codex:        0 executions
  claude:       0 executions
  gemini-stub:  0 executions

❌ Recent Failures (Last 10):
  1. [2026-01-03T07:27:13Z] task-1767424712318 / iteration=1
     Provider: copilot
     Exit Code: 1
     Error: Command failed: npx copilot --model 2.5-flash-lite ...
     Error Pattern: INVALID_MODEL_NAME

  2. [2026-01-03T07:27:10Z] testing-0091 / iteration=19059
     Provider: copilot
     Exit Code: 1
     Error: error: option '--model' argument 'gemini-2.5-flash-lite' is invalid
     Error Pattern: INVALID_MODEL_NAME

📊 Exit Code Distribution:
  Code 0 (success):  0
  Code 1 (failure):  2
  Other:             0

⚠️  Error Pattern Analysis:
  Most Common: INVALID_MODEL_NAME (2/2 = 100%)
    - Suggests: Model validation issue on enqueue, or provider fallback bug
    - Files: TASK_SCHEMA.json, cliAdapter.ts

🔍 Execution Timeline for testing-0091:
  Iteration 0:   [PROMPT:07:26:09Z] → [RESPONSE:07:26:09Z] (copilot, exit=0)
                 → [HELPER_RESPONSE:07:26:22Z] (failed validation)
  Iteration 62:  [PROMPT:07:28:14Z] → [RESPONSE:07:28:15Z] (copilot, exit=1, INVALID_MODEL)
  Iteration 87:  [FIX_PROMPT:07:27:12Z] → [RESPONSE:07:27:13Z] (copilot, exit=1, INVALID_MODEL)
  
  Summary: Task stuck in validation loop. Model name invalid from start.
```

**Implementation Notes**:
- Parse JSONL line-by-line (streaming for large files)
- Aggregate stats by provider, exit code, error type
- Build error pattern matcher (regex for common errors)
- Support filtering by task_id, date range, error pattern
- Calculate execution timeline

---

## Script 4: `schema.ts`

**Shared Types** for all investigation scripts

```typescript
export interface CircuitBreakerStatus {
  provider: Provider;
  triggered_at: string;
  expires_at: string;
  error_type: string;
}

export interface TaskState {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  iteration: number;
  retry_count: number;
  last_error: string | null;
  blocked_since?: string;
}

export interface SupervisorState {
  queue: string[];
  blocked_tasks: string[];
  failed_tasks: string[];
  current_task: string | null;
  [key: string]: unknown;
}
```

---

## Documentation: `README.md`

**Structure**:

```markdown
# Investigation Scripts

Diagnostic tools for troubleshooting supervisor issues.

## Quick Start

```bash
# Health check (providers + circuit breakers)
npx ts-node scripts/investigations/provider-health.ts

# Queue diagnostic (blocked tasks, retry status)
npx ts-node scripts/investigations/task-queue-inspect.ts

# Log analysis (recent errors, execution timeline)
npx ts-node scripts/investigations/log-analyzer.ts --summary
```

## Troubleshooting Matrix

| Problem | Scripts | Next Steps |
|---------|---------|-----------|
| "Why is system using Copilot instead of Gemini?" | provider-health.ts | Check circuit breaker status & TTL |
| "Task stuck for hours with no progress" | task-queue-inspect.ts → log-analyzer.ts | Identify error pattern, check blocked_reason |
| "All tasks failing with same error" | log-analyzer.ts --failures | See error pattern analysis |
| "Provider keeps switching unexpectedly" | provider-health.ts + log-analyzer.ts --task | Check circuit breaker triggers in logs |

## Script Reference

### provider-health.ts
Diagnose provider availability, circuit breaker status.
- --provider <name> : Check specific provider
- --only-breakers : Show only active circuit breakers
- --clear <provider> : Clear circuit breaker (dangerous, needs confirmation)

### task-queue-inspect.ts
Diagnose task queue, blocked tasks, retry status.
- --filter <blocked|failed|queued> : Show specific category
- --task-id <id> : Show details for one task
- --unblock <id> : Remove from blocked list (needs confirmation)

### log-analyzer.ts
Extract patterns from execution logs.
- --summary : Provider usage statistics
- --failures --limit N : Show recent failures
- --task <id> : Show execution timeline for task
- --exit-codes : Count exit code distribution
```

---

## Benefits of This Approach

✅ **Reusable**: Each script handles a distinct problem domain
✅ **Composable**: Use individually or chain for full diagnostic
✅ **Maintainable**: Centralized types + shared patterns
✅ **Extensible**: Easy to add new flags/queries
✅ **User-Friendly**: Clear output, actionable recommendations
✅ **Production-Ready**: Matches existing script patterns (dump-state.ts style)

---

## Implementation Order

1. **schema.ts** (shared types)
2. **provider-health.ts** (simplest, no state parsing)
3. **task-queue-inspect.ts** (requires state loading)
4. **log-analyzer.ts** (requires log file parsing)
5. **README.md** (documentation + matrix)

---

## Future Enhancements

- Add JSON output mode (`--format json`) for programmatic use
- Add export/report generation (`--export report.html`)
- Add real-time monitoring mode (`--watch` with interval updates)
- Integration with supervisor state snapshots for time-series analysis

