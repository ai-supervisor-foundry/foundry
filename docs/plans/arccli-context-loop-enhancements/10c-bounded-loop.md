# 10c — Bounded Autonomous Loop (RalphLoop)

## Source Files
- `crates/arc-core/src/ralph_loop.rs` — Bounded iteration config + execution
- `tests/integration/loop_scheduler.rs` — Duration parser, schedule config

## Loop Config

```typescript
interface LoopConfig {
  maxIterations: number;         // default 10
  completionPromise: string;     // "Task is fully complete"
  cooldownMs: number;            // default 2000
  stopOnError: boolean;
}

type LoopStatus = 'running' | 'paused' | 'completed' | 'max_iterations' | 'error';
```

## Iteration Prompts

- **Iteration 0**: `"Begin working towards: {task}. Max iterations: {N}."`
- **Iteration N**: `"Continue. Iteration {M}/{N}. Previous: {prev}. Say DONE if complete."`

## Completion Detection

- String match: `"DONE"` or `"complete"` in result
- Future: stop-hook evaluation for semantic detection

## Iteration Record

```typescript
interface IterationRecord {
  iteration: number;
  prompt: string;
  resultSummary: string;
  durationMs: number;
  filesChanged: string[];
}
```

## Cron Scheduler

```typescript
interface CronJob {
  id: string;
  interval: string;           // "5m", "1h30m"
  prompt: string;
  maxIterations: number;
  iterationsRun: number;
  enabled: boolean;
  lastRun: Date | null;
}

class CronScheduler {
  addLoop(interval: string, prompt: string): string { /* job ID */ }
  pendingJobs(): CronJob[] { }
  markRun(id: string): void { }
  cancel(id: string): void { }
}
```

Duration parsing supports: `s`, `m`, `h`, `d` suffixes, composite values
(`"1h30m"`), rejects zero durations.

## Persistent Schedule Config

```json
{
  "tasks": {
    "deploy-check": {
      "prompt": "check deployments",
      "interval": "5m",
      "enabled": true,
      "maxRuns": 100,
      "worktreeIsolation": false
    }
  }
}
```

## Acceptance Criteria

- [ ] BoundedLoop with max iterations, completion detection, cooldown
- [ ] Duration parser supports composite intervals
- [ ] CronScheduler manages persistent scheduled tasks
- [ ] IterationRecord captures per-iteration metrics
