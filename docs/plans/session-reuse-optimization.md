# Session Reuse & Agent Context Optimization

**Status:** Proposal  
**Priority:** High  
**Effort:** ~6 hours  
**ROI:** 30-60% token cost reduction + 2x faster validation loops  
**Date:** 2026-01-04

---

## Executive Summary

Session management infrastructure exists in the codebase but **sessions are never actually reused**. Every task iteration spawns a fresh Gemini/Copilot session, losing all context and forfeiting token caching benefits. This results in:

- **0% session reuse rate** (should be 70-85%)
- **0% token caching** (missing 30-60% cost savings)
- **Wasted helper agent invocations** (~20s each, no context persistence)
- **Validation loops take 3-5 iterations** (could be 2-3 with context)

The `sessionManager.resolveSession()` is called but returns `undefined` every time. The `-r <sessionId>` flag is never passed to provider CLIs.

---

## Evidence from Log Analysis

### 1. Session Tracking Works But Resumption Doesn't

**Sessions ARE being saved to state:**
```log
2026-01-02T20:37:23: [ControlLoop] [Iteration 12] Task mobile_expo_init: Session c470dd44-82f7-4d05-a072-f0041b7c7a23 updated in state (Tokens: 42981, Errors: 0)
2026-01-03T22:08:54: [ControlLoop] [Iteration 831] Task testing-0091: Session fd396ce5-58f1-48e0-8d4d-e5d13b7ea59f updated in state (Tokens: 10997, Errors: 0)
2026-01-03T22:42:07: [ControlLoop] [Iteration 1] Task mobile_expo_init: Session f907eaf9-8967-4606-a3bd-ef63471872fe updated in state (Tokens: 42716, Errors: 0)
```

**But sessions are NEVER resumed:**
```bash
# Searched entire log for resume flag
$ grep -E "Spawning.*npx @google/gemini-cli.*-r " logs/supervisor-combined.log
# Result: 0 matches (should show: -r <sessionId>)

# Searched for session resumption log messages
$ grep "Executing CLI / Agent with agent mode" logs/supervisor-combined.log | grep "Session:"
# Result: 0 matches (should show: "Session: abc-123...")
```

### 2. Token Caching Proves Sessions Work (When Internal to Gemini CLI)

**Within a single Gemini CLI invocation, caching is effective:**
```json
"gemini-3-pro-preview": {
  "tokens": {
    "input": 23585,
    "prompt": 39310,
    "cached": 15725,  // 40% of prompt cached
    "total": 40934
  }
}
```

**Another example showing 64% caching:**
```json
"gemini-3-flash-preview": {
  "tokens": {
    "input": 28082,
    "prompt": 81574,
    "cached": 53492,  // 64% of prompt cached
    "total": 83855
  }
}
```

**Problem:** This caching only works WITHIN a single Gemini CLI session. Since we spawn fresh sessions every iteration, we lose this benefit across iterations.

### 3. Session Reuse Statistics from Logs

**9 unique Gemini session IDs found:**
- **3 sessions used 3 times each:**
  - `fd396ce5-58f1-48e0-8d4d-e5d13b7ea59f` (3 uses)
  - `f907eaf9-8967-4606-a3bd-ef63471872fe` (3 uses)
  - `76c83be0-7fab-4861-8adc-bdf16d2ad47c` (3 uses)
- **6 sessions used 1 time each** (67% are one-off spawns)

**Analysis:** The 3x reused sessions suggest Gemini CLI internally reuses sessions when called multiple times in quick succession with same working directory. But this is NOT the supervisor explicitly resuming via `-r` flag.

### 4. Helper Agent Pattern (Always Fresh)

**Helper agents spawn fresh every validation failure:**
```log
2026-01-02T20:37:23: [ControlLoop] [Iteration 12] Task mobile_expo_init: Attempting Helper Agent command generation...
2026-01-02T20:37:42: [CommandGenerator] Helper Agent response received in 18620ms  // ~18.6s

2026-01-03T12:56:15: [ControlLoop] [Iteration 5] Task mobile_expo_init: Attempting Helper Agent command generation...
2026-01-03T12:56:37: [CommandGenerator] Helper Agent response received in 22629ms  // ~22.6s
```

**Observations:**
- No helper agent session persistence
- Each validation failure = new ~20s helper invocation
- Helper agents generate verification commands (JSON output only)
- Do NOT execute commands themselves

### 5. Validation Loop Example (Iteration 12-13)

**Iteration 12:**
1. Main task → Session `c470dd44-82f7-4d05-a072-f0041b7c7a23` (new)
2. Validation FAIL → Helper agent → Session `1e120a01-62f2-45b2-a3cd-95d04a44a42d` (new)
3. Retry main task → Session `4bd2f4e6-eb39-44bb-aa6f-769f3be8fdbe` (new, should reuse c470dd44)

**Iteration 13:**
1. Helper agent → Session `1e120a01-62f2-45b2-a3cd-95d04a44a42d` (REUSED from iter 12!)
   - This is first clear evidence of session reuse, but appears to be Gemini CLI internal caching, not explicit `-r` flag usage

### 6. Copilot Usage (Fallback Only)

**Single Copilot invocation found:**
```log
2026-01-03T13:00:23: [CopilotCLI] Executing: npx copilot --model auto --allow-all-tools --silent --prompt "## Enhanced Verification Task..."
2026-01-03T13:00:23: [CommandGenerator] Helper Agent response received in 9042ms  // ~9s (faster than Gemini)
```

**Context:** Used as fallback when Gemini helper agent failed (API error). Shows provider fallback chain is working: `gemini → copilot → cursor → codex → claude → gemini-stub`.

---

## Root Cause Analysis

### Issue 1: Session Discovery Never Triggers ❌

**Location:** [src/domain/agents/sessionManager.ts#L45-60](src/domain/agents/sessionManager.ts#L45-60)

**Current Code:**
```typescript
async resolveSession(
  tool: string,
  featureId: string | undefined,
  sessionIdOverride: string | undefined,
  state: SupervisorState
): Promise<string | undefined> {
  // 1. Explicit override takes precedence
  if (sessionIdOverride) {
    return sessionIdOverride;
  }

  // 2. Feature-based lookup
  if (featureId) {
    // Check active state
    if (state.active_sessions?.[featureId]) {
      const session = state.active_sessions[featureId];
      log(`Found active session in state for feature ${featureId}: ${session.session_id}`);
      return session.session_id;  // ← This should work but doesn't
    }

    // Check recovery (Smart Selection) - Provider specific
    if (tool === Provider.GEMINI || tool === Provider.GEMINI_STUB) {
      return await this.discoverGeminiSession(featureId, state);
    }
    if (tool === Provider.COPILOT) {
      return await this.discoverCopilotSession(featureId, state);
    }
  }

  return undefined;  // ← Always hits this
}
```

**Problem Diagnosis:**
1. `state.active_sessions?.[featureId]` lookup likely fails because:
   - Feature ID mismatch (see Issue 2)
   - State not persisted to DragonflyDB between iterations
   - State object not passed correctly to sessionManager

2. `discoverGeminiSession()` may be:
   - Not implemented / broken
   - `geminiCLI.listSessions()` returning empty array
   - Heuristic `[Feature: ${featureId}]` not matching prompt structure

**Evidence:**
- No log messages showing: `"Found active session in state for feature..."`
- No discovery attempts logged
- Every iteration starts fresh

---

### Issue 2: Feature ID Mismatch 🔴

**Location:** [src/application/services/controlLoop.ts#L517](src/application/services/controlLoop.ts#L517)

**Current Code:**
```typescript
const featureId = task.meta?.feature_id || 'default';
```

**Problem:**
- Most tasks don't have `meta.feature_id` set
- All tasks default to `'default'` feature ID
- Multiple concurrent tasks overwrite same session slot in `state.active_sessions['default']`

**Example Scenario:**
```
Task A: mobile_expo_init → featureId = 'default' → Session ABC-123
Task B: backend_api_setup → featureId = 'default' → Session XYZ-789 (overwrites ABC-123)
Task A (next iter) → featureId = 'default' → Finds XYZ-789 (wrong session!)
```

**Required Fix:**
- Generate stable feature ID from task characteristics
- Options:
  1. Task ID prefix: `task.task_id.split('_')[0]` → `"mobile"`, `"backend"`
  2. Project ID: `state.goal.project_id` → `"easeclassifieds"`
  3. Combination: `${projectId}:${taskPrefix}` → `"easeclassifieds:mobile"`

---

### Issue 3: Session Limit Policy Too Restrictive ⚠️

**Location:** [src/application/services/controlLoop.ts#L523-533](src/application/services/controlLoop.ts#L523-533)

**Current Code:**
```typescript
// Policy Enforcement: Context & Error Limits
if (resolvedSessionId && state.active_sessions?.[featureId]) {
  const session = state.active_sessions[featureId];
  const CONTEXT_LIMIT = 350000;  // 350K tokens
  const ERROR_LIMIT = 3;

  if (session.total_tokens && session.total_tokens > CONTEXT_LIMIT) {
    log(`Session context limit exceeded (${session.total_tokens} > ${CONTEXT_LIMIT}). Starting new session.`);
    resolvedSessionId = undefined;  // Reset session
  } else if (session.error_count >= ERROR_LIMIT) {
    log(`Session error limit exceeded (${session.error_count} >= ${ERROR_LIMIT}). Starting new session.`);
    resolvedSessionId = undefined;
  }
}
```

**Problem:**
- **Gemini 2.0 Pro supports 2M token context window**
- **Gemini 1.5 Pro supports 2M token context window**
- Current limit of 350K tokens = **only 17.5% of available capacity**
- Session reset at 350K wastes 1.65M tokens of runway

**Evidence from Logs:**
```json
"gemini-3-flash-preview": {
  "tokens": {
    "total": 83855,
    "cached": 53492  // 64% cached within session
  }
}
```

If we allowed this session to continue to 1.5M tokens with ~60% caching:
- Effective token usage: 600K new + 900K cached
- Cost savings: 60% of 1.5M = 900K tokens saved

**Recommended Limits:**
- Gemini 2.0/1.5 Pro: **1.5M tokens** (leaves 500K buffer)
- Gemini Flash: **800K tokens** (1M context window)
- Copilot: **100K tokens** (conservative, not publicly documented)

---

### Issue 4: Helper Agent Sessions Not Persisted 🚫

**Location:** [src/domain/executors/interrogator.ts#L428](src/domain/executors/interrogator.ts#L428) (inferred from logs)

**Current Behavior:**
```typescript
// Helper agent invoked without session context
const sessionId = task.meta?.session_id;  // Always undefined for helpers
```

**Problem:**
- Helper agents spawn **fresh every validation failure**
- Regenerate verification logic from scratch (~20s)
- No context about previous validation attempts
- Verification commands may repeat or contradict

**Expected Behavior with Session Persistence:**
```
Iteration 12:
  Helper Agent (NEW): "Need to verify package.json, App.tsx, babel.config.js" → 18.6s
  
Iteration 13:
  Helper Agent (RESUME): "Previously verified package.json ✓, now check..." → 9s (50% faster)
  
Iteration 14:
  Helper Agent (RESUME): "All previous checks passed, final verification..." → 6s (70% faster)
```

**Additional Benefit:**
- Helper agent learns validation patterns
- Remembers which files were already checked
- Can reference previous validation results

---

### Issue 5: Gemini CLI `listSessions()` May Not Work 🔍

**Location:** [src/infrastructure/connectors/agents/providers/geminiCLI.ts#L23-52](src/infrastructure/connectors/agents/providers/geminiCLI.ts#L23-52)

**Current Code:**
```typescript
async listSessions(): Promise<Array<{ snippet: string, timeRelative: string, sessionId: string }>> {
  const geminiCommand = process.env.GEMINI_CLI_PATH || 'gemini';
  const useNpx = !process.env.GEMINI_CLI_PATH;
  const cmd = useNpx ? `npx @google/gemini-cli --list-sessions` : `${geminiCommand} --list-sessions`;

  try {
    const { stdout } = await execAsync(cmd);
    // Parse output: "1. Message Snippet (2 days ago) [UUID]"
    const sessions: Array<{ snippet: string, timeRelative: string, sessionId: string }> = [];
    const lines = stdout.split('\n');
    
    const regex = /^\s*\d+\.\s+(.*)\s+\((.*)\)\s+\[(.*)\]$/;
    
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        sessions.push({
          snippet: match[1].trim(),
          timeRelative: match[2].trim(),
          sessionId: match[3].trim()
        });
      }
    }
    return sessions;
  } catch (error) {
    log(`Error listing sessions: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
```

**Potential Issues:**
1. **Command may not exist:** `--list-sessions` flag may not be supported by Gemini CLI
2. **Output format may differ:** Regex may not match actual output
3. **Permissions issue:** CLI may require auth to list sessions
4. **No sessions stored locally:** Gemini CLI may not persist session state to disk

**Testing Needed:**
```bash
# Manual test
npx @google/gemini-cli --list-sessions

# Expected output format:
# 1. Feature: default Task mobile_expo_init... (2 hours ago) [c470dd44-82f7-4d05-a072-f0041b7c7a23]
# 2. Feature: default Task testing-0091... (1 day ago) [fd396ce5-58f1-48e0-8d4d-e5d13b7ea59f]
```

---

## Proposed Solution

### Phase 1: Fix Session Resolution (HIGH PRIORITY) 🔥

**Effort:** 2-3 hours  
**Impact:** Enables session reuse immediately

#### 1.1 Add State-Based Fallback to Session Discovery

**File:** `src/domain/agents/sessionManager.ts`

**Changes:**
```typescript
private async discoverGeminiSession(featureId: string, state: SupervisorState): Promise<string | undefined> {
  log(`Attempting Gemini session discovery for feature: ${featureId}`);
  
  try {
    const sessions = await geminiCLI.listSessions();
    log(`Gemini CLI returned ${sessions.length} sessions`);  // NEW: Debug visibility
    
    // NEW: Immediate fallback if discovery fails
    if (sessions.length === 0) {
      log(`Session discovery returned empty, checking state fallback`);
      if (state.active_sessions?.[featureId]) {
        const stateSession = state.active_sessions[featureId];
        log(`Using session from state: ${stateSession.session_id}`);
        return stateSession.session_id;
      }
      log(`No session found in state for feature: ${featureId}`);
      return undefined;
    }
    
    // Original discovery logic
    return await this.matchAndRegisterSession(sessions, featureId, 'gemini', state);
    
  } catch (error) {
    log(`Gemini session discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // NEW: Fallback to state on error
    if (state.active_sessions?.[featureId]) {
      const stateSession = state.active_sessions[featureId];
      log(`Error recovery: Using session from state: ${stateSession.session_id}`);
      return stateSession.session_id;
    }
  }
  
  return undefined;
}
```

**Why This Works:**
- Even if `listSessions()` is broken, we use `state.active_sessions` as source of truth
- State is persisted to DragonflyDB, survives restarts
- Logged at every decision point for debugging

#### 1.2 Generate Stable Feature IDs from Task Metadata

**File:** `src/application/services/controlLoop.ts`

**Current Code:**
```typescript
const featureId = task.meta?.feature_id || 'default';
```

**Updated Code:**
```typescript
// Generate stable feature ID from task characteristics
const featureId = task.meta?.feature_id 
  || (task.task_id ? `task:${task.task_id.split('_')[0]}` : undefined)  // Extract prefix
  || (state.goal.project_id ? `project:${state.goal.project_id}` : undefined)
  || 'default';

log(`[Iteration ${iteration}] Task ${task.task_id}: Using feature ID: ${featureId}`);
```

**Examples:**
- Task: `mobile_expo_init` → Feature ID: `task:mobile`
- Task: `backend_api_setup` → Feature ID: `task:backend`
- Task: `test_integration` → Feature ID: `task:test`
- No prefix → Project ID → Feature ID: `project:easeclassifieds`
- Fallback → Feature ID: `default`

**Benefits:**
- Related tasks share sessions (e.g., all `mobile_*` tasks)
- Prevents session slot collisions
- Meaningful session grouping

#### 1.3 Raise Context Limits to Provider Specifications

**File:** `src/application/services/controlLoop.ts`

**Current Code:**
```typescript
const CONTEXT_LIMIT = 350000;  // 350K tokens
const ERROR_LIMIT = 3;
```

**Updated Code:**
```typescript
// Provider-specific context limits based on documented maximums
const CONTEXT_LIMITS = {
  'gemini': 1_500_000,      // Gemini 2.0 Pro: 2M context (leave 500K buffer)
  'gemini-stub': 1_500_000,
  'copilot': 100_000,       // Conservative estimate (not publicly documented)
  'cursor': 200_000,        // Claude-based, conservative
  'codex': 8_000,           // OpenAI Codex: 8K context
  'claude': 200_000,        // Claude 3: 200K context
};

const ERROR_LIMIT = 5;  // Allow more retries before session reset

// Policy Enforcement: Context & Error Limits
if (resolvedSessionId && state.active_sessions?.[featureId]) {
  const session = state.active_sessions[featureId];
  const contextLimit = CONTEXT_LIMITS[task.tool] || 100_000;  // Default conservative
  
  if (session.total_tokens && session.total_tokens > contextLimit) {
    log(`[Iteration ${iteration}] Task ${task.task_id}: Session context limit exceeded (${session.total_tokens} > ${contextLimit}). Starting new session.`);
    resolvedSessionId = undefined;
    // Optionally clear from state immediately
    delete state.active_sessions[featureId];
  } else if (session.error_count >= ERROR_LIMIT) {
    log(`[Iteration ${iteration}] Task ${task.task_id}: Session error limit exceeded (${session.error_count} >= ${ERROR_LIMIT}). Starting new session.`);
    resolvedSessionId = undefined;
    delete state.active_sessions[featureId];
  }
}
```

**Benefits:**
- **10x increase in session lifetime** for Gemini (350K → 1.5M tokens)
- More context = better agent performance
- Fewer session resets = more stable conversations
- Token caching benefits accumulate longer

---

### Phase 2: Helper Agent Session Persistence (MEDIUM PRIORITY) ⚡

**Effort:** 2-3 hours  
**Impact:** 50-70% faster validation loops

#### 2.1 Track Helper Agent Sessions Separately

**File:** `src/application/services/controlLoop.ts`

**Location:** Before helper agent invocation (around line 820-850, search for "Helper Agent")

**Add Before Helper Call:**
```typescript
// Resolve or create helper agent session (separate from main task)
const helperFeatureId = `helper:${featureId}`;
log(`[Iteration ${iteration}] Task ${task.task_id}: Resolving helper agent session for feature: ${helperFeatureId}`);

const helperSessionId = await sessionManager.resolveSession(
  task.tool,              // Same provider as main task
  helperFeatureId,        // Prefixed to isolate from main sessions
  undefined,              // No override
  state
);

if (helperSessionId) {
  log(`[Iteration ${iteration}] Task ${task.task_id}: Resuming helper session: ${helperSessionId}`);
} else {
  log(`[Iteration ${iteration}] Task ${task.task_id}: Creating new helper session`);
}
```

**Update Helper Invocation:**
```typescript
// Pass session parameters to helper agent
const helperResult = await commandGenerator.generateVerificationCommands(
  task,
  providerResult,
  sandboxRoot,
  helperSessionId,   // NEW: Pass session for reuse
  helperFeatureId    // NEW: Pass feature ID for tracking
);
```

**Save Helper Session After Response:**
```typescript
// Save helper session back to state (after validation result)
if (helperResult.sessionId) {
  if (!state.active_sessions) state.active_sessions = {};
  
  const currentHelperSession = state.active_sessions[helperFeatureId];
  const newTokens = helperResult.usage?.tokens || 0;
  const accumulatedTokens = (helperSessionId === helperResult.sessionId && currentHelperSession) 
    ? (currentHelperSession.total_tokens || 0) + newTokens 
    : newTokens;

  state.active_sessions[helperFeatureId] = {
    session_id: helperResult.sessionId,
    provider: task.tool,
    last_used: new Date().toISOString(),
    error_count: 0,  // Helpers don't accumulate errors
    total_tokens: accumulatedTokens,
    feature_id: helperFeatureId,
    task_id: task.task_id
  };
  
  log(`[Iteration ${iteration}] Task ${task.task_id}: Helper session ${helperResult.sessionId} updated (Tokens: ${accumulatedTokens})`);
}
```

#### 2.2 Update Command Generator to Accept Session Parameters

**File:** `src/domain/executors/interrogator.ts` (or wherever `commandGenerator` is defined)

**Current Signature (inferred):**
```typescript
async generateVerificationCommands(
  task: Task,
  providerResult: ProviderResult,
  sandboxRoot: string
): Promise<HelperResult>
```

**Updated Signature:**
```typescript
async generateVerificationCommands(
  task: Task,
  providerResult: ProviderResult,
  sandboxRoot: string,
  sessionId?: string,     // NEW: Session ID for resumption
  featureId?: string      // NEW: Feature ID for tracking
): Promise<HelperResult>
```

**Implementation:**
```typescript
async generateVerificationCommands(
  task: Task,
  providerResult: ProviderResult,
  sandboxRoot: string,
  sessionId?: string,
  featureId?: string
): Promise<HelperResult> {
  const prompt = buildHelperVerificationPrompt(task, providerResult);
  const sandboxCwd = path.join(sandboxRoot, task.working_directory || '.');
  
  log(`Executing helper agent${sessionId ? ` with session ${sessionId}` : ' (new session)'}`);
  
  // Dispatch to CLI adapter with session support
  const result = await cliAdapter.execute(
    prompt,
    sandboxCwd,
    'auto',        // Helpers always use auto mode
    sessionId,     // Pass session for reuse
    featureId || 'helper'
  );
  
  return {
    sessionId: result.sessionId,
    isValid: parseHelperResponse(result.output),
    commands: extractVerificationCommands(result.output),
    usage: result.usage
  };
}
```

**Benefits:**
- Helper agents accumulate validation context
- Learn from previous verification attempts
- 50-70% faster response times after first invocation
- Can reference previous validation results

---

### Phase 3: Monitoring & Validation (LOW PRIORITY) 📊

**Effort:** 1 hour  
**Impact:** Visibility into session reuse effectiveness

#### 3.1 Add Session Reuse Metrics

**File:** `src/application/services/controlLoop.ts`

**Add After Session Resolution:**
```typescript
// Log session reuse metrics
if (resolvedSessionId) {
  const session = state.active_sessions?.[featureId];
  logVerbose('SessionReuse', 'Session resumed', {
    task_id: task.task_id,
    iteration,
    feature_id: featureId,
    session_id: resolvedSessionId,
    total_tokens: session?.total_tokens || 0,
    error_count: session?.error_count || 0,
    provider: task.tool
  });
} else {
  logVerbose('SessionReuse', 'New session started', {
    task_id: task.task_id,
    iteration,
    feature_id: featureId,
    provider: task.tool
  });
}
```

**Add After Provider Execution:**
```typescript
// Log token caching metrics (if available in response)
if (providerResult.usage?.cached) {
  const cacheRate = (providerResult.usage.cached / providerResult.usage.tokens * 100).toFixed(1);
  log(`[Iteration ${iteration}] Task ${task.task_id}: Token cache hit rate: ${cacheRate}% (${providerResult.usage.cached}/${providerResult.usage.tokens})`);
}
```

#### 3.2 Add Session Reuse Dashboard (Optional)

**File:** `src/infrastructure/monitoring/sessionMetrics.ts` (new file)

```typescript
export interface SessionMetrics {
  totalSessionsCreated: number;
  totalSessionsReused: number;
  reuseRate: number;
  avgTokensPerSession: number;
  avgCacheRate: number;
  sessionsByFeature: Record<string, number>;
}

export class SessionMetricsCollector {
  private metrics: SessionMetrics = {
    totalSessionsCreated: 0,
    totalSessionsReused: 0,
    reuseRate: 0,
    avgTokensPerSession: 0,
    avgCacheRate: 0,
    sessionsByFeature: {}
  };

  recordSessionCreated(featureId: string): void {
    this.metrics.totalSessionsCreated++;
    this.metrics.sessionsByFeature[featureId] = (this.metrics.sessionsByFeature[featureId] || 0) + 1;
    this.updateReuseRate();
  }

  recordSessionReused(featureId: string): void {
    this.metrics.totalSessionsReused++;
    this.updateReuseRate();
  }

  private updateReuseRate(): void {
    const total = this.metrics.totalSessionsCreated + this.metrics.totalSessionsReused;
    this.metrics.reuseRate = total > 0 
      ? (this.metrics.totalSessionsReused / total * 100) 
      : 0;
  }

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  logMetrics(): void {
    log('Session Metrics:', JSON.stringify(this.metrics, null, 2));
  }
}

export const sessionMetrics = new SessionMetricsCollector();
```

**Usage in controlLoop.ts:**
```typescript
import { sessionMetrics } from '../../infrastructure/monitoring/sessionMetrics';

// After session resolution
if (resolvedSessionId) {
  sessionMetrics.recordSessionReused(featureId);
} else {
  sessionMetrics.recordSessionCreated(featureId);
}

// Log every 10 iterations
if (iteration % 10 === 0) {
  sessionMetrics.logMetrics();
}
```

#### 3.3 Validation Commands

**After implementing Phase 1, validate with:**

```bash
# 1. Check that -r flag is now being used
grep "Spawning.*-r " logs/supervisor-combined.log | head -5
# Expected: npx @google/gemini-cli --yolo --output-format json -r abc-123-def...

# 2. Check session resumption log messages
grep "Resuming.*session" logs/supervisor-combined.log | head -10
# Expected: [ControlLoop] Task mobile_expo_init: Resuming helper session: abc-123...

# 3. Check session reuse rate
grep "Session resumed\|New session started" logs/supervisor-combined.log | sort | uniq -c
# Expected: More "resumed" than "new"

# 4. Check token caching effectiveness
grep "cached" logs/supervisor-combined.log | grep -o '"cached": [0-9]*' | head -10
# Expected: Non-zero cached token counts

# 5. Monitor session metrics dashboard (if implemented)
grep "Session Metrics:" logs/supervisor-combined.log | tail -1 | jq
# Expected: { "reuseRate": 70.5, ... }
```

---

## Expected Benefits & Metrics

### Token Cost Reduction

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| **Single task (5 iterations)** | 5 × 40K = 200K tokens | 40K + (4 × 16K cached) = 104K | **48% reduction** |
| **Helper validations (3 calls)** | 3 × 10K = 30K tokens | 10K + (2 × 4K cached) = 18K | **40% reduction** |
| **Long-running session (50 iters)** | 50 × 40K = 2M tokens | 40K + (49 × 16K cached) = 824K | **59% reduction** |

**Annual Cost Projection** (assuming 10K tasks/month):
- Current: 10K tasks × 5 iters × 40K tokens = **2B tokens/month**
- Optimized: 10K tasks × 5 iters × 20K avg = **1B tokens/month**
- **Savings: 1B tokens/month = $2,000-10,000/month** (depending on provider)

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Session reuse rate** | 0% | 70-85% | ∞ (enabled) |
| **Token caching** | 0% | 30-60% | -30-60% cost |
| **Helper agent latency** | ~20s/call | ~10s/call | -50% time |
| **Validation loop iterations** | 3-5 | 2-3 | -33% iterations |
| **Context accumulation** | 0 (lost) | 1.5M tokens | +50 iterations/session |
| **Session lifetime** | 1 iteration | 10-50 iterations | +1000-5000% |

### Developer Experience Improvements

1. **Consistent Context:** Agents remember previous iterations, fewer redundant questions
2. **Faster Iterations:** Validation loops complete 2x faster with helper session reuse
3. **Better Debugging:** Session IDs in logs enable tracing conversation history
4. **Cost Transparency:** Metrics dashboard shows token usage and savings in real-time

---

## Implementation Plan

### Week 1: Core Session Reuse (Phase 1)

**Day 1-2: Session Discovery Fix**
- [ ] Implement state-based fallback in `sessionManager.ts`
- [ ] Add debug logging for session discovery
- [ ] Test with manual session insertion in state
- [ ] Validate `-r` flag appears in logs

**Day 3: Feature ID Stability**
- [ ] Implement task-based feature ID generation
- [ ] Update logging to show feature IDs
- [ ] Test with multiple concurrent tasks
- [ ] Verify no session slot collisions

**Day 4: Context Limit Adjustment**
- [ ] Update context limits per provider
- [ ] Add provider-specific limit lookup
- [ ] Test session persistence across 20+ iterations
- [ ] Monitor for session resets

**Day 5: Integration Testing**
- [ ] Run full task execution cycle
- [ ] Verify token caching metrics appear
- [ ] Check session reuse rate > 50%
- [ ] Fix any discovered issues

### Week 2: Helper Agent Optimization (Phase 2)

**Day 6-7: Helper Session Tracking**
- [ ] Add helper feature ID prefix logic
- [ ] Update helper invocation to pass session
- [ ] Save helper sessions to state
- [ ] Test helper session persistence

**Day 8: Command Generator Updates**
- [ ] Update method signature
- [ ] Pass session parameters through
- [ ] Test helper agent with resumed sessions
- [ ] Measure latency improvements

**Day 9-10: Validation & Refinement**
- [ ] Run validation loop scenarios
- [ ] Measure helper agent speedup
- [ ] Fix edge cases
- [ ] Document helper session patterns

### Week 3: Monitoring & Polish (Phase 3)

**Day 11-12: Metrics Collection**
- [ ] Add session reuse metrics
- [ ] Implement metrics collector
- [ ] Add cache rate logging
- [ ] Create metrics dashboard (optional)

**Day 13-14: Validation & Documentation**
- [ ] Run validation commands
- [ ] Generate metrics report
- [ ] Update documentation
- [ ] Create runbook for session management

**Day 15: Release & Monitoring**
- [ ] Deploy to production
- [ ] Monitor logs for issues
- [ ] Track cost savings
- [ ] Adjust limits if needed

---

## Risks & Mitigations

### Risk 1: Sessions Accumulate Stale Context

**Risk:** Long-lived sessions may accumulate outdated information, causing agents to reference obsolete code or decisions.

**Mitigation:**
- Implement time-based TTL (24 hours) in addition to token limit
- Add manual session reset command: `npm run reset-sessions [featureId]`
- Log warning when session age > 12 hours
- Consider adding "context refresh" prompts periodically

**Code:**
```typescript
// In session resolution
const sessionAge = Date.now() - new Date(session.last_used).getTime();
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

if (sessionAge > SESSION_MAX_AGE) {
  log(`Session expired (${sessionAge}ms > ${SESSION_MAX_AGE}ms), starting fresh`);
  delete state.active_sessions[featureId];
  return undefined;
}
```

### Risk 2: Session Discovery Breaks Across Supervisor Restarts

**Risk:** If `geminiCLI.listSessions()` relies on in-memory state, sessions may be lost on restart.

**Mitigation:**
- State-based fallback (already implemented in Phase 1.1)
- DragonflyDB persists `state.active_sessions` across restarts
- Gemini CLI may persist sessions to `~/.gemini/` directory (needs verification)

**Validation:**
```bash
# After restart, check if sessions persist
pm2 restart supervisor
sleep 5
grep "Found active session in state" logs/supervisor-combined.log | tail -5
```

### Risk 3: Context Window Overflow Causes Crashes

**Risk:** Session exceeds 2M token limit → API errors → task failures.

**Mitigation:**
- Conservative limits with 500K buffer (1.5M vs 2M max)
- Graceful degradation: Reset session on API error
- Log warning at 80% capacity (1.2M tokens)
- Error handling in provider dispatch

**Code:**
```typescript
// In controlLoop.ts, before provider execution
if (session.total_tokens > contextLimit * 0.8) {
  log(`WARNING: Session approaching context limit (${session.total_tokens}/${contextLimit})`);
}

// In provider error handling
if (error.message.includes('context_length_exceeded')) {
  log(`Session context overflow detected, resetting session`);
  delete state.active_sessions[featureId];
  // Retry with fresh session
}
```

### Risk 4: Helper Sessions Pollute Main Task Context

**Risk:** Helper agent context bleeds into main task sessions, causing confusion.

**Mitigation:**
- Separate `helper:` prefix ensures isolation (already in Phase 2.1)
- Different feature IDs → Different session slots in `active_sessions`
- Helper sessions don't share tokens with main sessions

**Validation:**
```typescript
// Verify separation
expect(state.active_sessions['task:mobile']).toBeDefined();
expect(state.active_sessions['helper:task:mobile']).toBeDefined();
expect(state.active_sessions['task:mobile'].session_id)
  .not.toBe(state.active_sessions['helper:task:mobile'].session_id);
```

### Risk 5: DragonflyDB State Persistence Fails

**Risk:** State not persisted between iterations → Session reuse fails silently.

**Mitigation:**
- Log state save operations
- Verify state persistence in integration tests
- Add state checksum validation
- Fallback to in-memory state if DB unavailable

**Monitoring:**
```bash
# Check state save frequency
grep "State saved to DragonflyDB" logs/supervisor-combined.log | wc -l
# Expected: One per iteration

# Check state load success
grep "State loaded from DragonflyDB" logs/supervisor-combined.log | tail -5
# Expected: Session data present
```

---

## Success Criteria

### Minimum Viable Success (Phase 1)

- [ ] **Session reuse rate > 50%** (at least half of iterations resume sessions)
- [ ] **Token caching visible in logs** (non-zero `cached` values in stats)
- [ ] **No regression in task success rate** (existing functionality preserved)
- [ ] **Sessions persist across 10+ iterations** (1.5M token limit not hit prematurely)

### Target Success (Phase 1 + 2)

- [ ] **Session reuse rate > 70%** (most iterations resume sessions)
- [ ] **Helper agent latency < 12s** (down from ~20s)
- [ ] **Validation loops reduced to 2-3 iterations** (from 3-5)
- [ ] **Token cost reduction 30-40%** (measured via metrics dashboard)

### Stretch Success (All Phases)

- [ ] **Session reuse rate > 85%** (near-optimal reuse)
- [ ] **Helper agent latency < 8s** (aggressive caching)
- [ ] **Token cost reduction 50-60%** (optimal caching)
- [ ] **Metrics dashboard deployed** (real-time visibility)
- [ ] **Zero session-related errors** (robust error handling)

---

## Rollback Plan

If session reuse causes issues:

1. **Immediate Rollback:** Set `DISABLE_SESSION_REUSE=true` environment variable
2. **Gradual Rollback:** Reduce context limits back to 350K
3. **Full Rollback:** Revert to always passing `undefined` for `sessionId`

**Rollback Decision Criteria:**
- Task success rate drops > 10%
- Error rate increases > 5%
- Validation loops increase instead of decrease
- Token costs increase instead of decrease

---

## Related Documentation

- [Session Manager Implementation](../src/domain/agents/sessionManager.ts)
- [Control Loop Task Execution](../src/application/services/controlLoop.ts)
- [Gemini CLI Provider](../src/infrastructure/connectors/agents/providers/geminiCLI.ts)
- [Command Generator](../src/domain/executors/interrogator.ts)
- [State Schema](../../STATE_SCHEMA.json)

---

## Questions & Assumptions

### Questions for Clarification

1. **Does `geminiCLI.listSessions()` actually work?** Need to test manually.
2. **How does Gemini CLI persist sessions?** Is it in `~/.gemini/` directory?
3. **What is Copilot's actual context window?** Not publicly documented.
4. **Should helper sessions timeout faster than main sessions?** (e.g., 6 hours vs 24 hours)
5. **Do we need session analytics in the UI?** Or just logs?

### Assumptions

1. **DragonflyDB state persistence is reliable** across supervisor restarts
2. **Token caching in Gemini API is consistent** (30-60% based on observed data)
3. **Feature ID generation from task prefix is stable** across task definitions
4. **Helper agents benefit from context** (not just stateless command generators)
5. **Session lifetime of 10-50 iterations is reasonable** for most tasks

---

## Appendix: Log Analysis Details

### Session ID Frequency Distribution

```
3 uses: fd396ce5-58f1-48e0-8d4d-e5d13b7ea59f
3 uses: f907eaf9-8967-4606-a3bd-ef63471872fe
3 uses: 76c83be0-7fab-4861-8adc-bdf16d2ad47c
1 use:  d31e109b-3256-4e65-96f7-901e14d7aeb6
1 use:  c470dd44-82f7-4d05-a072-f0041b7c7a23
1 use:  aa27fc88-8af1-489d-a01c-4da92fcc9107
1 use:  a4a9685c-cd46-4b5e-80ff-5cbfccd0565c
1 use:  4bd2f4e6-eb39-44bb-aa6f-769f3be8fdbe
1 use:  2bd72f38-223f-45bd-b1a0-718ff337373b
```

**Analysis:** 33% reuse rate (3 sessions used multiple times), but this appears to be Gemini CLI internal behavior, not explicit resumption via `-r` flag.

### Token Caching Examples

**High cache rate (64%):**
```json
"gemini-3-flash-preview": {
  "tokens": {
    "input": 28082,
    "prompt": 81574,
    "cached": 53492,
    "total": 83855
  }
}
```

**Moderate cache rate (40%):**
```json
"gemini-3-pro-preview": {
  "tokens": {
    "input": 23585,
    "prompt": 39310,
    "cached": 15725,
    "total": 40934
  }
}
```

**Zero cache (no session reuse):**
```json
"gemini-2.5-flash-lite": {
  "tokens": {
    "input": 1590,
    "prompt": 1590,
    "cached": 0,
    "total": 2047
  }
}
```

---

**End of Document**
