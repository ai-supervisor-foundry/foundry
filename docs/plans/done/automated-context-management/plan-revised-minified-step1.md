# Plan: Unified Context & Knowledge System (REVISED)

**Status**: Ready for Implementation  
**Risk Level**: Low  
**Timeline**: Phase 1 = 2-3 days, Phase 2 = TBD (optional, future)  

---

## Problem Statement

The Supervisor currently provides minimal runtime context to agents:
1. **Last task only** (or less)
2. **No semantic information** (why was the task done? what does it mean?)
3. **No multi-step awareness** (agent forgets context from previous 5-10 tasks)

This leads to "amnesia" where agents:
- Repeat mistakes from earlier tasks
- Lose coherence in multi-step implementations
- Struggle to find relevant code in large projects

**Current Architecture Already Provides**:
- Full task history in `state.completed_tasks[]`
- Detailed audit log in `sandbox/<project>/logs/audit.log.jsonl`
- Blocked tasks list with reasons

**Gap**: No **semantic context** (task intent, completion summary) to make history meaningful.

---

## Objective

Implement a **two-phase context system**:
- **Phase 1 (Now)**: Enhance runtime context with task intent/summary—agent always knows "where it came from"
- **Phase 2 (Future, Conditional)**: Semantic code retrieval (RAG) if Phase 1 proves insufficient

**Success Criteria**:
- Agent can reference last 5 completed tasks by intent
- Agent can see active blockers and their reasons
- No new infrastructure dependencies
- Zero performance regression (<10ms overhead per prompt)
- Existing state remains backward compatible

---

## Phase 1: Enhanced Runtime Context (Working Memory)

### Goal
Fix immediate amnesia by enriching `CompletedTask` with semantic information.

### 1.1 Schema Migration (Backward-Compatible)

**Current State** (`src/domain/types/types.ts` line 117):
```typescript
export interface CompletedTask {
  task_id: string;
  completed_at: string;
  validation_report: ValidationReport;
}
```

**Change Required** (update `src/domain/types/types.ts`):
```typescript
export interface CompletedTask {
  task_id: string;
  completed_at: string;
  requires_context?: boolean; // Feature toggle (default false, preserves old behavior)
  intent?: string;          // ADDED: Task intent (optional for backward compat)
  summary?: string;         // ADDED: Optional deterministic summary
  validation_report: ValidationReport;
}
```

**Why Optional?**
- Old state in Redis won't have these fields
- Loader automatically backfills missing values (see section 1.1.1)
- No crash on restart with old state
- Serialization/deserialization handles missing fields gracefully
- `requires_context` defaults to false; when false we keep legacy prompts, when true we capture intent/summary and inject them (toggle flows through backend/UI forms)

#### 1.1.1 State Loader Enhancement

**File**: `src/application/services/persistence.ts` (lines 23–77)

**Current Implementation**:
```typescript
export async function loadState(
  client: Redis,
  stateKey: string
): Promise<SupervisorState> {
  const startTime = Date.now();
  const rawValue = await client.get(stateKey);
  
  if (rawValue === null) {
    throw new Error(`State key ${stateKey} not found`);
  }

  const parsed = JSON.parse(rawValue) as SupervisorState;
  return parsed;  // ← No backfill of missing fields
}
```

**Enhancement Required**:
```typescript
export async function loadState(
  client: Redis,
  stateKey: string
): Promise<SupervisorState> {
  const startTime = Date.now();
  const rawValue = await client.get(stateKey);
  
  if (rawValue === null) {
    throw new Error(`State key ${stateKey} not found`);
  }

  const parsed = JSON.parse(rawValue) as SupervisorState;
  
  // BACKFILL: Handle missing intent/summary in old state
  if (parsed.completed_tasks) {
    for (let i = 0; i < parsed.completed_tasks.length; i++) {
      const task = parsed.completed_tasks[i];
      
      // If intent is missing, use task_id as placeholder
      if (!task.intent) {
        task.intent = `[Legacy] ${task.task_id}`;
        logVerbose('LoadState', 'Backfilled missing intent', {
          task_id: task.task_id,
          fallback_intent: task.intent,
        });
      }
      
      // Summary is optional; leave undefined if missing
      // It will be populated on next task completion
    }
  }
  
  const totalDuration = Date.now() - startTime;
  logPerformance('LoadState', totalDuration, { state_key: stateKey });
  return parsed;
}
```

**What This Does**:
- ✅ Old state loads without crashes
- ✅ Missing intents backfilled with deterministic fallback
- ✅ Subsequent saves include the new fields
- ✅ No audit log needed (intent is best-effort)
- ✅ Backward compatible: first time load, then forward progress

#### 1.1.2 TaskFinalizer Enhancement

**File**: `src/application/services/controlLoop/modules/taskFinalizer.ts` (lines 1–97)

**Current Implementation** (lines 30–39):
```typescript
// 2. Mark as completed
if (!state.completed_tasks) {
  state.completed_tasks = [];
}
state.completed_tasks.push({
  task_id: task.task_id,
  completed_at: new Date().toISOString(),
  validation_report: validationReport,
});
```

**Enhanced Implementation**:
```typescript
// 2. Mark as completed with semantic information
if (!state.completed_tasks) {
  state.completed_tasks = [];
}

const completedTask: CompletedTask = {
  task_id: task.task_id,
  completed_at: new Date().toISOString(),
  intent: task.intent,                         // Capture from current task
  summary: this.generateTaskSummary(task, validationReport),
  validation_report: validationReport,
};

state.completed_tasks.push(completedTask);

// NEW: Prune old tasks to cap state size
state.completed_tasks = this.pruneCompletedTasks(state.completed_tasks);
```

**Add Helper Methods** (to `TaskFinalizer` class):
```typescript
/**
 * Generate deterministic summary (no LLM, no creativity)
 * Only facts: success/failure + reason
 */
private generateTaskSummary(task: Task, report: ValidationReport): string {
  if (!report.valid) {
    return `Failed: ${report.reason || 'Unknown reason'}`;
  }
  
  // Extract first sentence of intent (up to first period or 60 chars)
  const firstSentence = task.intent.split('.')[0].trim();
  const truncated = firstSentence.length > 60 
    ? firstSentence.slice(0, 60) + '...' 
    : firstSentence;
  
  return `Completed: ${truncated}`;
}

/**
 * Keep completed_tasks capped at 100 entries
 * Keeps only most recent tasks in-memory state
 * Full history remains in audit.log.jsonl
 */
private pruneCompletedTasks(tasks: CompletedTask[]): CompletedTask[] {
  const MAX_RECENT_TASKS = 100;
  
  if (tasks.length <= MAX_RECENT_TASKS) {
    return tasks;
  }
  
  const pruned = tasks.slice(-MAX_RECENT_TASKS);
  const removed = tasks.length - pruned.length;
  
  this.logger.log('TaskFinalizer', 'Pruned completed_tasks', {
    total: tasks.length,
    kept: pruned.length,
    removed,
    max_cap: MAX_RECENT_TASKS,
  });
  
  return pruned;
}
```

**What This Does**:
- ✅ Captures task intent on completion (captured from `task.intent` passed in)
- ✅ Generates deterministic summary (no LLM, pure logic)
- ✅ Keeps state size bounded (~100 tasks × ~5KB = ~500KB max)
- ✅ No extra I/O (in-memory pruning before Redis write)
- ✅ Full history preserved in audit log

### 1.2 Sliding Window Injection

**File**: `src/domain/agents/promptBuilder.ts` (lines 1–180)

**Current State** (lines 16–33):
```typescript
export interface MinimalState {
  project: {
    id: string;
    sandbox_root: string;
  };
  goal?: {
    id: string;
    description: string;
  };
  queue?: {
    last_task_id?: string;
  };
  completed_tasks?: Array<{
    task_id: string;
    completed_at: string;
  }>;
  blocked_tasks?: Array<{
    task_id: string;
    reason: string;
  }>;
}
```

**Update MinimalState Interface**:
```typescript
export interface MinimalState {
  project: {
    id: string;
    sandbox_root: string;
  };
  goal?: {
    id: string;
    description: string;
    completed?: boolean;
  };
  queue?: {
    last_task_id?: string;
  };
  recent_completed_tasks?: Array<{        // ← NEW: Always include
    task_id: string;
    completed_at: string;
    intent: string;                        // ← NEW: Task intent
    success: boolean;                      // ← NEW: Success flag
  }>;
  active_blockers?: Array<{                // ← NEW: Always include
    task_id: string;
    reason: string;
    blocked_at: string;
  }>;
  // (Legacy field kept for compatibility, but deprecated)
  completed_tasks?: Array<{
    task_id: string;
    completed_at: string;
  }>;
  blocked_tasks?: Array<{
    task_id: string;
    reason: string;
  }>;
}
```

**Update `buildMinimalState()` Function** (lines 68–180):

**Current Logic** (lines 78–145):
```typescript
export function buildMinimalState(task: Task, state: SupervisorState, sandboxCwd: string): MinimalState {
  const context: MinimalState = { project: { ... } };
  
  // Conditional logic: goal only if mentioned
  if (instructionsLower.includes('goal') || ...) {
    context.goal = { ... };
  }
  
  // Conditional logic: queue only if temporal refs
  if (instructionsLower.includes('previous') || ...) {
    context.queue = { ... };
  }
  
  // Conditional logic: tasks only if 'extend' keyword
  const shouldExtend = (instructionsLower.includes('extend') || ...);
  if (shouldExtend) {
    context.completed_tasks = state.completed_tasks?.slice(-5).map(...);
  } else if (state.completed_tasks && state.completed_tasks.length > 0) {
    context.completed_tasks = state.completed_tasks.slice(-1).map(...);
  }
  
  // Conditional logic: blockers only if 'unblock' keyword
  if (instructionsLower.includes('unblock') || ...) {
    context.blocked_tasks = state.blocked_tasks?.map(...);
  }
  
  return context;
}
```

**New Logic** (ALWAYS inject recent tasks + blockers):
```typescript
export function buildMinimalState(task: Task, state: SupervisorState, sandboxCwd: string): MinimalState {
  const context: MinimalState = {
    project: {
      id: state.goal.project_id || 'default',
      sandbox_root: sandboxCwd,
    },
  };

  // ALWAYS: Include last 3-5 completed tasks (working memory)
  if (state.completed_tasks && state.completed_tasks.length > 0) {
    const recentTasks = state.completed_tasks.slice(-5);
    context.recent_completed_tasks = recentTasks.map(t => ({
      task_id: t.task_id,
      completed_at: t.completed_at,
      intent: t.intent || `[Unknown] ${t.task_id}`,
      success: t.validation_report.valid,
    }));
    logVerbose('BuildMinimalState', 'Injected recent tasks', {
      task_id: task.task_id,
      recent_tasks_count: context.recent_completed_tasks.length,
    });
  }

  // ALWAYS: Include active blockers (critical awareness)
  if (state.blocked_tasks && state.blocked_tasks.length > 0) {
    context.active_blockers = state.blocked_tasks.map(t => ({
      task_id: t.task_id,
      reason: t.reason,
      blocked_at: t.blocked_at,
    }));
    logVerbose('BuildMinimalState', 'Injected active blockers', {
      task_id: task.task_id,
      blocker_count: context.active_blockers.length,
    });
  }

  // Include goal if relevant (existing logic)
  const instructionsLower = task.instructions.toLowerCase();
  const intentLower = task.intent.toLowerCase();
  const criteriaText = task.acceptance_criteria.join(' ').toLowerCase();
  
  if (
    instructionsLower.includes('goal') ||
    intentLower.includes('goal') ||
    criteriaText.includes('goal') ||
    task.task_id.startsWith('goal-')
  ) {
    context.goal = {
      id: state.goal.project_id || 'default',
      description: state.goal.description,
      completed: state.goal.completed,
    };
  }

  // Include queue if temporal references (existing logic)
  if (
    instructionsLower.includes('previous') ||
    instructionsLower.includes('last task') ||
    instructionsLower.includes('earlier')
  ) {
    context.queue = {
      last_task_id: state.supervisor.last_task_id,
    };
  }

  logVerbose('BuildMinimalState', 'Context complete', {
    task_id: task.task_id,
    has_recent_tasks: !!context.recent_completed_tasks,
    has_blockers: !!context.active_blockers,
    has_goal: !!context.goal,
    has_queue: !!context.queue,
  });

  return context;
}
```

**What This Does**:
- ✅ Agents **always** receive last 5 task intents (working memory)
- ✅ Agents **always** know what's blocked and why (critical awareness)
- ✅ No conditional keywords required (unconditional injection)
- ✅ Backward compatible (legacy fields still present but deprecated)
- ✅ ~2-5ms extra in prompt builder (negligible)

### 1.3 Prompt Consumption (Example)

When agent receives the updated prompt, the injected context now includes (from `buildMinimalState()`):

```markdown
## Recent Task History
You have completed the following tasks recently:

1. task-042: "Implement user authentication module"
   - Completed: 2026-01-11T10:00Z
   - Status: ✓ Success

2. task-043: "Add JWT validation middleware"
   - Completed: 2026-01-11T10:05Z
   - Status: ✓ Success

3. task-044: "Create login endpoint"
   - Completed: 2026-01-11T10:10Z
   - Status: ✓ Success

4. task-045: "Fix CORS headers"
   - Completed: 2026-01-11T10:15Z
   - Status: ✓ Success

5. task-046: "Handle token refresh logic"
   - Completed: 2026-01-11T10:20Z
   - Status: ✓ Success

## Active Blockers
- task-047: "Add password reset flow"
  - Reason: Waiting for email service configuration

## Your Current Task
task-048: "Implement logout endpoint"

Intent: "Implement logout endpoint that clears user session and revokes tokens."

Instructions: ...rest of task prompt...
Acceptance Criteria: ...
```

**Benefits for Agent**:
- ✅ **Context**: Agent knows authentication system just implemented, can follow established patterns
- ✅ **Continuity**: Agent sees what blocked the last task, avoids repeating mistakes
- ✅ **History**: Agent has 5-task window to understand multi-step progress
- ✅ **Determinism**: Same intents always presented (not fuzzy/random)

### 1.4 Implementation Checklist

**Phase 1 is self-contained. These steps can be done independently but should follow this order:**

**Step 1: Schema Update** (1 hour)
- [ ] Update `CompletedTask` interface in `src/domain/types/types.ts` (line 117)
  - Add `intent?: string`
  - Add `summary?: string`
- [ ] Update `STATE_SCHEMA.json` documentation to reflect new fields
- [ ] Verify TypeScript compilation: `npm run build`

**Step 2: State Loader Enhancement** (1 hour)
- [ ] Update `loadState()` function in `src/application/services/persistence.ts` (lines 23–77)
  - Add backfill logic for missing intent (use `[Legacy] {task_id}` fallback)
  - Add logging for backfill events
- [ ] Test with old state snapshot (create a test fixture with pre-Phase1 state)
- [ ] Verify backfill doesn't crash: `npm test -- persistence`

**Step 3: TaskFinalizer Enhancement** (2 hours)
- [ ] Add `generateTaskSummary()` method to `TaskFinalizer` class
  - Extract summary from task.intent (first sentence, max 60 chars)
  - Return "Failed: {reason}" for failed tasks
- [ ] Add `pruneCompletedTasks()` method to `TaskFinalizer` class
  - Cap at 100 tasks, keep most recent
  - Log pruning events
- [ ] Update `finalizeTask()` to:
  - Build `CompletedTask` with intent + summary
  - Call pruning before returning
- [ ] Test pruning logic: `npm test -- taskFinalizer`

**Step 4: PromptBuilder Enhancement** (2 hours)
- [ ] Update `MinimalState` interface to include:
  - `recent_completed_tasks?: Array<{task_id, completed_at, intent, success}>`
  - `active_blockers?: Array<{task_id, reason, blocked_at}>`
- [ ] Update `buildMinimalState()` to **always** inject:
  - Last 5 completed tasks (with intents)
  - All active blockers
  - Conditional goal/queue (unchanged)
- [ ] Add logging for what was injected
- [ ] Test integration: `npm test -- promptBuilder`

**Step 5: Integration Testing** (2 hours)
- [ ] Load old state fixture, verify backfill works, verify new fields populated
- [ ] Create task, complete it, verify intent + summary captured
- [ ] Complete 150 tasks, verify pruning keeps only 100
- [ ] Build prompt, verify recent_tasks + blockers always present
- [ ] Verify prompt size increase is <5% (benchmark with large state)

**Step 6: Performance Validation** (1 hour)
- [ ] Benchmark state load time (target: <5ms overhead)
- [ ] Benchmark prompt builder time (target: <5ms overhead)
- [ ] Benchmark task finalization time (target: <10ms overhead)
- [ ] Document findings in PERFORMANCE_NOTES.md

**Step 7: Documentation** (30 mins)
- [ ] Update `TASK_SCHEMA.json` with new fields
- [ ] Add migration notes to docs/MIGRATION.md or README
- [ ] Document backward compatibility story

**Total Estimated Time**: 9.5 hours (1-2 days with testing)

**Quality Gates**:
- ✅ All TypeScript errors resolved
- ✅ All unit tests pass
- ✅ Integration test: old state loads correctly
- ✅ Integration test: new state persists correctly
- ✅ Performance overhead <10ms on any operation
- ✅ No changes to control loop or critical paths (except TaskFinalizer, which is safe)

---

## Phase 2: Native RAG Integration (Future, Conditional)

**Status**: DO NOT IMPLEMENT YET

**Prerequisites Before Starting Phase 2**:
1. ✅ Phase 1 deployed and running for 2+ weeks
2. ✅ Agent context amnesia problem **verified as NOT SOLVED** by Phase 1
3. ✅ Operator explicitly approves RAG investment
4. ✅ RediSearch module loaded into DragonflyDB (requires docker-compose change)

### 2.1 Assessment Checkpoint

Before Phase 2, measure:
- Do agents still repeat mistakes after Phase 1?
- Do agents still lose context in multi-step tasks?
- Is the 5-task window sufficient?

**If YES to both**: Phase 1 solved the problem. Ship it.  
**If NO**: Design Phase 2 carefully (see below).

### 2.2 Redesigned Phase 2 (If Needed)

If RAG is needed, use this safer approach:

#### Option A: Lightweight Filename Index (Recommended)

**No embeddings. Just searchable file catalog.**

```typescript
// src/infrastructure/adapters/codebaseIndex/simpleFileIndexAdapter.ts
export class SimpleFileIndexAdapter {
  async indexSandbox(sandboxRoot: string): Promise<void> {
    const files = await this.scanFiles(sandboxRoot);
    
    const index = {};
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const firstLines = content.split('\n').slice(0, 5).join('\n');
      
      index[file] = {
        path: file,
        firstLines: firstLines.slice(0, 200), // First 200 chars
        size: content.length,
      };
    }
    
    // Store in Redis as simple hash
    await redis.hset('codebase:index', index);
  }
  
  async findRelatedFiles(query: string, topK: number = 3): Promise<File[]> {
    // Simple substring search on filenames
    const allFiles = await redis.hgetall('codebase:index');
    const matches = Object.values(allFiles)
      .filter(f => f.path.includes(query.toLowerCase()))
      .slice(0, topK);
    
    return matches;
  }
}
```

**Benefits**:
- ✅ No ML models, no embeddings
- ✅ Instant search (<5ms)
- ✅ Deterministic (same query = same results)
- ✅ No extra infrastructure
- ✅ Can be toggled off easily

#### Option B: Async Background Indexer (If Full RAG Needed)

**Key constraints**:
- Runs **async** in background worker thread (doesn't block control loop)
- **Per-task incremental** updates (not full re-scan)
- **Bounded** by file count + size limits
- **Validated** before injection (file exists, within sandbox, not binary)

```typescript
// src/application/services/backgroundIndexing/asyncCodebaseIndexer.ts
export class AsyncCodebaseIndexer {
  private indexWorker: Worker;
  private isIndexing = false;
  
  constructor(private logger: LoggerPort) {
    // Spawn background worker thread
    this.indexWorker = new Worker('./codebaseIndexWorker.ts');
  }
  
  async indexSandboxAsync(
    sandboxRoot: string, 
    changedFiles?: string[]
  ): Promise<void> {
    if (this.isIndexing) {
      this.logger.debug('Indexer', 'Already indexing; skipping');
      return; // Don't queue up
    }
    
    this.isIndexing = true;
    
    this.indexWorker.postMessage({
      command: 'index',
      sandboxRoot,
      changedFiles,
      limits: {
        maxFiles: 500,
        maxFileSizeKB: 500,
        skipDirs: ['.git', 'node_modules', 'dist', '.next', 'build'],
      },
    });
    
    await new Promise((resolve) => {
      this.indexWorker.once('message', () => {
        this.isIndexing = false;
        resolve(undefined);
      });
    });
  }
}
```

**In TaskFinalizer** (fire-and-forget, no blocking):
```typescript
// After state is persisted
if (this.asyncIndexer) {
  // Non-blocking: index in background
  this.asyncIndexer.indexSandboxAsync(sandboxRoot, changedFiles)
    .catch(error => {
      this.logger.warn('BackgroundIndexing', 'Failed; continuing', { error });
    });
}
```

**Benefits**:
- ✅ Zero impact on control loop
- ✅ Bounded resource usage
- ✅ Can timeout/cancel safely
- ✅ Can be disabled via config

### 2.3 RAG Injection with Validation

**If Phase 2 proceeds**, apply these gates:

```typescript
export async function buildRAGContext(
  task: Task,
  sandboxRoot: string,
  index: CodebaseIndexPort
): Promise<string> {
  try {
    // 1. Search for relevant chunks
    const chunks = await index.search(task.intent, topK: 5);
    
    // 2. Validate each chunk
    const validated = [];
    for (const chunk of chunks) {
      // Gate 1: File exists and is readable
      if (!fs.existsSync(path.join(sandboxRoot, chunk.filePath))) {
        continue;
      }
      
      // Gate 2: Within sandbox (path traversal check)
      const resolved = path.resolve(path.join(sandboxRoot, chunk.filePath));
      if (!resolved.startsWith(path.resolve(sandboxRoot))) {
        continue;
      }
      
      // Gate 3: Not binary
      if (isBinaryFile(chunk.filePath)) {
        continue;
      }
      
      // Gate 4: Score threshold
      if (chunk.score < 0.70) {
        continue;
      }
      
      validated.push(chunk);
    }
    
    // 3. Limit output size
    const maxChars = 2000; // ~500 tokens
    let output = '';
    for (const chunk of validated.slice(0, 3)) {
      const addition = `\n## ${chunk.filePath}\n${chunk.content}\n`;
      if ((output + addition).length > maxChars) break;
      output += addition;
    }
    
    return output;
    
  } catch (error) {
    // Fail silently: missing RAG doesn't break task
    logger.warn('RAG', 'Failed to build context', { error });
    return '';
  }
}
```

---

## Benefits Summary

### Phase 1
- **Cost**: $0
- **Implementation**: 2-3 days
- **Risk**: Low (backward compatible)
- **Performance**: <5ms overhead
- **Benefit**: Agents retain 5-task context + understand blockers

### Phase 2 (If Needed)
- **Cost**: $0 (no external services)
- **Implementation**: 3-5 days
- **Risk**: Medium (new complexity)
- **Performance**: 50-200ms depending on index size
- **Benefit**: Semantic code retrieval for large projects

---

## Testing Strategy

### Phase 1 Tests

**Unit Tests**:
```typescript
describe('CompletedTask Enhancement', () => {
  test('backfills missing intent from audit log', async () => {
    const oldState = { completed_tasks: [{ task_id: 'task-001' }] };
    const newState = await loader.loadState(oldState);
    expect(newState.completed_tasks[0].intent).toBeDefined();
  });
  
  test('caps completed_tasks at 100', async () => {
    const stateWith150Tasks = { completed_tasks: Array(150).fill({...}) };
    const pruned = finalizer.pruneCompletedTasks(stateWith150Tasks.completed_tasks);
    expect(pruned).toHaveLength(100);
  });
  
  test('always injects recent tasks in MinimalState', () => {
    const state = { completed_tasks: [...5 tasks...] };
    const minimal = buildMinimalState(task, state, '/sandbox');
    expect(minimal.recent_completed_tasks).toHaveLength(5);
  });
});
```

**Integration Tests**:
```typescript
describe('Phase 1 End-to-End', () => {
  test('old state loads without crash', async () => {
    const oldState = { /* pre-Phase1 state */ };
    const supervisor = new Supervisor(oldState);
    await supervisor.executeOneIteration();
    expect(supervisor.state.completed_tasks[0].intent).toBeDefined();
  });
  
  test('new state includes intent in persistence', async () => {
    const state = { ...initialState };
    await finalizer.finalizeTask(state, context);
    const persisted = await persistence.loadState();
    expect(persisted.completed_tasks[0].intent).toEqual(task.intent);
  });
});
```

**Performance Benchmark**:
```typescript
test('PromptBuilder overhead <10ms', () => {
  const start = performance.now();
  const minimal = buildMinimalState(task, largeState, '/sandbox');
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(10);
});
```

---

## Deployment Plan

### Pre-Deployment
- [ ] All tests pass
- [ ] Backward compatibility verified with production state snapshot
- [ ] Performance benchmarked (<10ms overhead)

### Deployment
1. Deploy code changes to staging
2. Run supervisor with old state from production → verify backfill works
3. Deploy to production (zero-downtime: schema additions are optional fields)
4. Monitor audit logs for any backfill failures

### Post-Deployment
- [ ] Track agent performance: Do they repeat fewer mistakes?
- [ ] Monitor state size: Is 100-task cap working?
- [ ] Gather feedback: Is 5-task window sufficient?

---

## Decision Points

| Question | If YES → | If NO → |
|----------|----------|---------|
| Is Phase 1 solving the amnesia problem? | Ship Phase 1 only | Proceed to Phase 2 |
| Is RediSearch loaded in DragonflyDB? | Can do full RAG in Phase 2 | Stick with simple filename index |
| Is the 5-task window sufficient? | Done | Increase to 10 tasks |
| Is state size growing too fast? | Lower cap to 50 tasks | Keep at 100 tasks |

---

## Rollback Plan

If Phase 1 introduces issues:

1. **Revert code** to pre-Phase1 commit
2. **Old state** is still readable (CompletedTask fields are optional)
3. **No data loss**: All tasks still in audit log

Rollback cost: 5 minutes.

---

## File References & Code Locations

### Schema
- **Types Definition**: [src/domain/types/types.ts](src/domain/types/types.ts#L117)
  - `CompletedTask` interface (line 117)
  - Add `intent?: string` and `summary?: string`
- **State Schema**: [STATE_SCHEMA.json](STATE_SCHEMA.json)
  - Update `completed_tasks` field description

### State Persistence
- **Persistence Layer**: [src/application/services/persistence.ts](src/application/services/persistence.ts)
  - `loadState()` function (lines 23–77)
  - `persistState()` function (lines 83–185)
  - `PersistenceLayer` class (lines 188–218)
  - Add backfill logic in `loadState()` to handle missing `intent`

### Task Finalization
- **TaskFinalizer**: [src/application/services/controlLoop/modules/taskFinalizer.ts](src/application/services/controlLoop/modules/taskFinalizer.ts)
  - `finalizeTask()` method (lines 25–97)
  - Update lines 30–39 to capture intent + summary
  - Add `generateTaskSummary()` helper method
  - Add `pruneCompletedTasks()` helper method

### Prompt Building
- **PromptBuilder**: [src/domain/agents/promptBuilder.ts](src/domain/agents/promptBuilder.ts)
  - `MinimalState` interface (lines 16–33)
  - `buildMinimalState()` function (lines 68–180)
  - Update interface to add `recent_completed_tasks` + `active_blockers`
  - Update function to always inject recent tasks + blockers

### Audit & Analytics
- **Audit Log Path**: `sandbox/<project>/logs/audit.log.jsonl`
  - Full task details stored here (audit log is single source of truth)
- **State Persistence**: Stored in Redis key (operator-defined, typically `supervisor:state`)
  - State is single-key full overwrite (see `persistState()`)

### Testing
- **Type Tests**: [tests/unit/types.test.ts](tests/unit/types.test.ts)
- **Persistence Tests**: [tests/unit/persistence.test.ts](tests/unit/persistence.test.ts)
- **TaskFinalizer Tests**: [tests/unit/taskFinalizer.test.ts](tests/unit/taskFinalizer.test.ts)
- **PromptBuilder Tests**: [tests/unit/promptBuilder.test.ts](tests/unit/promptBuilder.test.ts)

### Key Architectural Files (Reference Only)
- **Control Loop**: [src/application/services/controlLoop/index.ts](src/application/services/controlLoop/index.ts)
  - Calls `TaskFinalizer.finalizeTask()` after successful task completion
- **Persistence Port**: [src/domain/ports/persistence.ts](src/domain/ports/persistence.ts)
  - Interface defining `readState()` and `writeState()`
- **Logger**: [src/infrastructure/adapters/logging/logger.ts](src/infrastructure/adapters/logging/logger.ts)
  - Use `logVerbose()` for debug info, `logPerformance()` for perf timing

