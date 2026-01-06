# Plan: Enhanced Logging and Analytics (Phase 3)

## Goal
Transform the Supervisor from a "black box" that logs to a file into a measurable system that tracks efficiency, failure rates, and agent performance.

## Motivation
- **Debugging**: "Why did task X take 100 iterations?" is currently hard to answer without reading megabytes of logs.
- **Optimization**: We need data to know if our improvements (Smart Context, etc.) are actually working.

## Technical Approach

### 1. Metrics Schema
Define `TaskMetrics` in `src/domain/types/types.ts`.

```typescript
interface TaskMetrics {
  task_id: string;
  start_time: string;
  end_time?: string;
  total_duration_ms?: number;
  iterations: number;
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED';
  
  // Phase timing
  time_in_execution_ms: number;
  time_in_validation_ms: number;
  time_in_interrogation_ms: number;
  
  // Counts
  interrogation_rounds: number;
  helper_agent_calls: number;
  failed_validations: number;
  
  // Cost (Token proxy)
  total_prompt_chars: number;
  total_response_chars: number;
}
```

### 2. Metrics Service (`src/application/services/metrics.ts`)
- **Accumulator**: Tracks metrics in memory during `controlLoop` execution.
- **Persister**: Saves metrics to `sandbox/<project>/metrics.json` (append-only or structured JSON) or Redis `supervisor:metrics`.

### 3. CLI Command
Add `npm run cli -- metrics` command.
- Displays summary:
    *   "Average iterations per task: 12"
    *   "Success rate: 85%"
    *   "Slowest task: mobile_expo_init (45 mins)"
    *   "Most common error: Invalid JSON"

### 4. Integration
- Hook into `controlLoop.ts` start/end points.
- Hook into `cliAdapter.execute` to track chars.
- Hook into `validator.ts` to track validation time.

## Risk & Mitigation
- **Performance Impact**: Logging shouldn't slow down the loop.
    *   *Mitigation*: Async file writing, fire-and-forget.
- **Data Volume**: JSONL is preferred for scalability over a single huge JSON object.

## Verification
- Run a task.
- Check `metrics.json`.
- Run `supervisor metrics` and verify output matches logic.
