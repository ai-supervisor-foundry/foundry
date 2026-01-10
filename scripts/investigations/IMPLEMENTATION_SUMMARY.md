# Investigation Scripts Implementation Summary

**Completed**: January 2026  
**Purpose**: Reusable diagnostic toolkit for troubleshooting supervisor system issues  
**Status**: ✅ Implementation Complete

## Overview

Implemented a comprehensive investigation scripts framework consisting of 4 TypeScript utilities + shared schema + documentation, providing operators with reusable tools for diagnosing provider issues, task queue problems, and execution failures.

## Files Created (5)

### Core Investigation Scripts

1. **`scripts/investigations/schema.ts`** (116 lines)
   - Shared TypeScript interfaces for all scripts
   - **Interfaces**: CircuitBreakerStatus, CircuitBreakerInfo, TaskStateInfo, SupervisorState, ExecutionLogEntry, ProviderStats, ErrorPattern
   - **Utilities**: `calculateTimeRemaining()`, `formatTimestamp()`, `getStatusEmoji()`
   - **Purpose**: Single source of truth for types; ensures consistency across all investigation scripts

2. **`scripts/investigations/provider-health.ts`** (234 lines)
   - **Purpose**: Diagnose provider availability, circuit breaker status, and priority order
   - **Features**:
     - Shows provider priority chain (DEFAULT_PRIORITY from config)
     - Lists all active circuit breakers with remaining TTL
     - Calculates time until auto-recovery
     - Recommends actions (wait, clear, fix credentials)
   - **Flags**: `--provider <name>`, `--only-breakers`, `--clear <provider>`, `--json`
   - **Use Case**: "System uses Copilot instead of Gemini—why?"

3. **`scripts/investigations/task-queue-inspect.ts`** (233 lines)
   - **Purpose**: Diagnose task queue state, blocked/failed tasks, and retry status
   - **Features**:
     - Shows queue length and current task
     - Lists blocked tasks with blocked reasons
     - Lists failed tasks with error details
     - Tracks retry attempts per task
     - Identifies stuck tasks
   - **Flags**: `--filter <blocked|failed|queued>`, `--task-id <id>`, `--limit <number>`, `--json`
   - **Use Case**: "Tasks are stuck in queue—what's wrong?"

4. **`scripts/investigations/log-analyzer.ts`** (269 lines)
   - **Purpose**: Extract and analyze execution logs from prompts.log.jsonl
   - **Features**:
     - Aggregates statistics (total, successful, failed)
     - Provider usage breakdown with percentages
     - Exit code distribution
     - Error pattern frequency analysis
     - Recent entries with timestamps and durations
   - **Flags**: `--summary`, `--failures --limit N`, `--task <id>`, `--exit-codes`, `--providers`, `--json`
   - **Use Case**: "What's the failure rate? Which errors are most common?"

### Documentation

5. **`scripts/investigations/README.md`** (412 lines)
   - Complete usage guide with examples for each script
   - Troubleshooting matrix (problem → script → solution)
   - Configuration reference (Redis connection, log file location)
   - CI/CD integration examples
   - Script development template for adding new tools
   - Performance notes and limitations

## Documentation Updates (2)

### 1. **`docs/RUNBOOK.md`** - Added Section
   - New "Diagnostics & Investigation Scripts" section
   - Quick-start table mapping common issues to scripts
   - Three command examples with explanations
   - Architecture overview of 4 scripts
   - Link to detailed README for full documentation

### 2. **`README.md`** (Main) - Added Section
   - New "Diagnostics & Investigation Tools" subsection in Troubleshooting
   - Quick diagnostic commands (3 examples)
   - Description: "reusable diagnostic tools for inspecting provider health, task queue state, and execution logs"
   - Link to detailed investigation scripts README

## Features & Capabilities

### Provider Health Script
```bash
# Shows this:
- Priority order with availability status
- Active circuit breakers with error type
- Time remaining until auto-recovery
- Recommendations for each breaker
- Option to manually clear breakers (with confirmation)
```

### Task Queue Script
```bash
# Shows this:
- Current executing task with elapsed time
- Queue length and first N tasks
- Blocked tasks with block reasons and timestamps
- Failed tasks with error messages and retry counts
- Summary statistics
- Recommendations based on queue state
```

### Log Analyzer Script
```bash
# Shows this:
- Total/success/failed execution counts
- Provider usage percentages
- Exit code distribution
- Error pattern frequency (timeout, circuit_broken, etc.)
- Recent log entries with providers and durations
- Memory and timing statistics
```

## Design Patterns Used

1. **Shared Schema** (`schema.ts`)
   - Central TypeScript interfaces for all scripts
   - Utility functions for common formatting
   - Ensures type safety and consistency

2. **Commander.js CLI**
   - Consistent option parsing across all scripts
   - Standard `--redis-host`, `--redis-port`, `--json` flags
   - Matches existing script patterns (dump-state.ts, check-goal.ts)

3. **Human + JSON Output**
   - Human-readable terminal output by default (with emojis and tables)
   - `--json` flag for CI/CD automation and parsing
   - Supports monitoring pipeline integration

4. **Resource Cleanup**
   - All scripts use `try/finally` for Redis client cleanup
   - No resource leaks across invocations

## Command Examples

```bash
# Health check before deployment
npx ts-node scripts/investigations/provider-health.ts

# Find why tasks are stuck
npx ts-node scripts/investigations/task-queue-inspect.ts --filter blocked

# Analyze recent failures
npx ts-node scripts/investigations/log-analyzer.ts --failures --limit 20

# Get JSON for automation
npx ts-node scripts/investigations/provider-health.ts --json | jq '.circuit_breakers | length'

# Monitor in cron job
QUEUE_SIZE=$(npx ts-node scripts/investigations/task-queue-inspect.ts --json | jq '.queue.total_length')
if [ "$QUEUE_SIZE" -gt 100 ]; then echo "ALERT: Queue too large"; fi
```

## Troubleshooting Matrix Provided

| Problem | Root Cause | Investigation | Solution |
|---------|-----------|---------------|----------|
| **System uses wrong provider** | Circuit breaker active | `provider-health.ts` | Clear breaker or fix issue |
| **Tasks stuck in queue** | Queue processing hung | `task-queue-inspect.ts` | Check/unblock tasks, restart |
| **High failure rate** | Specific error pattern | `log-analyzer.ts --failures` | Identify pattern, fix cause |
| **One provider never used** | Breaker/priority issue | `provider-health.ts --provider` | Check status, verify config |
| **Memory growth** | Memory leak or large tasks | `log-analyzer.ts` + inspect | Identify leaky patterns |
| **All providers blocked** | Cascading failures | `provider-health.ts` | Critical! Restart system |

## Integration Points

1. **RUNBOOK.md** - Operators follow for troubleshooting
2. **README.md** - Main documentation mentions in Troubleshooting section
3. **Investigation Scripts README** - Standalone guide with examples
4. **CI/CD Ready** - JSON output flags for automation

## Future Extensibility

Provides template pattern for adding more investigation scripts:
- Create new script in `scripts/investigations/`
- Import types from `./schema.ts`
- Use Commander.js for CLI parsing
- Support `--json` flag for automation
- Add documentation to README.md

## Quality Assurance

✅ All 5 files created with meaningful content:
- 116 lines of shared types/utilities
- 234 lines of provider diagnostics
- 233 lines of queue inspection
- 269 lines of log analysis
- 412 lines of documentation

✅ Documentation updated in 2 key places:
- RUNBOOK.md with quick-start table and examples
- README.md main troubleshooting section

✅ Consistent with codebase:
- TypeScript configuration matches existing scripts
- Redis client pattern matches dump-state.ts
- Commander.js usage matches CLI adapter
- Error handling follows existing patterns

## User Benefits

1. **Operator Empowerment**: Self-service diagnostics without code access
2. **Faster Resolution**: Troubleshooting matrix guides to right tool
3. **Reusability**: Scripts work for all future investigations (not one-time)
4. **Automation**: JSON output enables CI/CD integration
5. **Documentation**: Examples show exactly what each script does
6. **Transparency**: Full source code available for customization
