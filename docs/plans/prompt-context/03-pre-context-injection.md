# Agent Switching with Pre-Context Injection

**Status:** Proposal  
**Priority:** Medium  
**ROI:** Improved agent continuity + reduced validation failures on provider fallback  
**Date:** 2026-01-04

---

## Executive Summary

When a provider/agent fails (circuit breaker triggers) or the helper agent is invoked, the **new agent lacks conversation history** from the previous agent. This can cause:
- Repeated failures due to missing context
- Validation errors from misunderstanding task state
- Wasted tokens re-explaining what was already attempted

**Proposed Solution:** Inject a **brief (<10 lines) pre-context** at the START of prompts when:
1. Circuit breaker triggers → switching to fallback provider
2. Helper agent is invoked after validation failure
3. Retry attempt after validation failure

This context provides the new agent with:
- What the previous agent attempted
- Why it failed (if known)
- Key files/changes from previous attempt
- Current validation failure reason (if applicable)

**Expected Impact:**
- **15-25% reduction** in retry failures (fewer repeated mistakes)
- **10-15% faster** task completion (less re-discovery)
- **Better validation continuity** (helper agent understands what to verify)

---

## Problem Statement

### Scenario 1: Circuit Breaker Triggers (Provider Fallback)

**Current Flow:**
```
Gemini (Provider 1):
  ├─ Attempts task
  ├─ Hits rate limit / quota exhausted
  ├─ Circuit breaker opens
  └─ Returns error

Copilot (Provider 2 - Fallback):
  ├─ Receives SAME prompt as Provider 1
  ├─ NO KNOWLEDGE of what Gemini attempted
  ├─ May repeat same mistake
  └─ Or waste time re-discovering context
```

**Issue:** Copilot doesn't know:
- What files Gemini created/modified
- What approach Gemini tried
- Why Gemini's attempt failed (beyond "rate limit")
- What the validation error was (if any)

**Example:**
```
Task: "Add authentication to Express app"

Gemini attempt:
- Created src/auth/middleware.ts
- Modified src/index.ts to add auth routes
- Failed validation: "auth routes not registered correctly"
- Circuit breaker triggered (quota exhausted)

Copilot receives:
- Original task prompt (no mention of Gemini's work)
- May recreate same files with same bug
- Or may not know middleware.ts already exists
```

### Scenario 2: Helper Agent Invoked After Validation Failure

**Current Flow:**
```
Main Agent (Gemini):
  ├─ Completes task
  ├─ Returns: status="completed", files_created=[...]
  └─ Claims acceptance criteria met

Supervisor:
  ├─ Runs validation
  ├─ Finds 2/3 criteria failed
  └─ Validation fails

Helper Agent:
  ├─ Receives: agent response + failed criteria
  ├─ NO KNOWLEDGE of retry history
  ├─ Generates verification commands
  └─ Commands may not account for previous attempts
```

**Issue:** Helper agent doesn't know:
- If this is the 1st, 2nd, or 3rd retry
- What the previous retry attempted to fix
- What files have been created/modified across retries
- If the task is stuck in a loop

**Example:**
```
Task: "Ensure /api/health endpoint exists"

Attempt 1:
- Agent creates src/routes/health.ts
- Validation fails: "endpoint not registered in app"

Attempt 2 (retry):
- Agent tries to register in src/index.ts
- Validation fails: "endpoint returns 404"

Helper Agent (on 2nd validation):
- Doesn't know routes/health.ts exists
- Generates commands to check file existence (redundant)
- Misses the real issue (routing configuration)
```

### Scenario 3: Retry After Validation Failure

**Current Flow:**
```
Attempt 1:
  ├─ Agent creates feature
  ├─ Validation fails: "Missing unit tests"
  └─ Retry scheduled

Attempt 2 (retry):
  ├─ Receives SAME prompt as Attempt 1
  ├─ NO KNOWLEDGE of previous validation failure
  ├─ May repeat same implementation
  └─ Validation fails again (same reason)
```

**Issue:** Retry agent doesn't know:
- Why previous attempt failed
- What was already implemented
- What specifically needs to be fixed

---

## Current Architecture Context

### 1. Multi-Provider Priority System

```typescript
// src/infrastructure/adapters/agents/providers/cliAdapter.ts
export class CLIAdapter {
  private readonly priority: Provider[];
  // Default: GEMINI → COPILOT → CURSOR → CODEX → CLAUDE

  async execute(prompt, workingDirectory, agentMode, sessionId, featureId) {
    // 1. Select first available provider (not circuit-broken)
    let selectedProvider = await this.selectProvider();

    // 2. Try each provider in priority order
    for (let i = priority.indexOf(selectedProvider); i < priority.length; i++) {
      const provider = priority[i];
      
      // Skip if circuit-broken
      if (await circuitBreaker.isOpen(provider)) continue;

      try {
        const result = await executeProvider(provider, prompt, ...);
        
        // Check if result should trigger circuit breaker
        if (shouldTriggerCircuitBreaker(provider, result)) {
          await circuitBreaker.open(provider);
          continue; // Try next provider
        }

        return result; // Success
      } catch (error) {
        // Try next provider
      }
    }

    // All providers failed
    return { status: 'FAILED', stderr: 'All providers circuit-broken' };
  }
}
```

**Current Limitation:** When falling back to next provider, the **same prompt** is sent. No context about previous failure is injected.

### 2. Prompt Construction

```typescript
// src/domain/agents/promptBuilder.ts
export function buildPrompt(task: Task, minimalState: MinimalState): string {
  const sections: string[] = [];

  sections.push('## Task ID');
  sections.push(task.task_id);

  sections.push('## Task Description');
  sections.push(task.instructions);

  sections.push('## Intent');
  sections.push(task.intent);

  sections.push('## Acceptance Criteria');
  // ... acceptance criteria

  sections.push('## READ-ONLY CONTEXT — DO NOT MODIFY');
  sections.push(JSON.stringify(minimalState, null, 2));

  // ... rules, output format, working directory

  return sections.join('\n');
}
```

**Current Limitation:** No mechanism to inject **execution history** or **previous attempt context**.

### 3. Helper Agent Prompt

```typescript
// src/domain/executors/commandGenerator.ts
function buildEnhancedHelperAgentPrompt(
  agentResponse: string,
  failedCriteria: string[],
  sandboxCwd: string,
  codeFiles: string[]
): string {
  const sections: string[] = [];

  sections.push('## Enhanced Verification Task');
  sections.push('You are a Helper Agent. Your task is to VERIFY, not assume.');

  sections.push('**Context:**');
  sections.push(`- Working Directory: ${sandboxCwd}`);

  sections.push('**Failed Criteria:**');
  failedCriteria.forEach((criterion, index) => {
    sections.push(`${index + 1}. ${criterion}`);
  });

  sections.push('**Agent Response:**');
  sections.push(agentResponse.substring(0, 5000));

  // ... verification rules

  return sections.join('\n');
}
```

**Current Limitation:** No context about **retry history**, **previous validation failures**, or **task execution timeline**.

---

## Proposed Solution

### 1. Pre-Context Injection Points

Inject brief context (<10 lines) at **three key points**:

#### Point A: Circuit Breaker Fallback

When circuit breaker triggers and we switch to fallback provider:

```typescript
// BEFORE provider fallback
const preContext = buildCircuitBreakerContext({
  failedProvider: 'gemini',
  failureReason: 'rate_limit_exceeded',
  previousAttempt: {
    files_created: ['src/auth/middleware.ts'],
    files_updated: ['src/index.ts'],
    status: 'failed',
    validationErrors: ['auth routes not registered correctly'],
  },
});

// Inject at START of prompt
const promptWithContext = `${preContext}\n\n${originalPrompt}`;
```

#### Point B: Helper Agent Invocation

When helper agent is invoked after validation failure:

```typescript
// BEFORE helper agent prompt
const preContext = buildHelperAgentContext({
  attemptNumber: 2, // This is the 2nd retry
  previousAttempts: [
    {
      files_created: ['src/routes/health.ts'],
      validationErrors: ['endpoint not registered in app'],
    },
    {
      files_updated: ['src/index.ts'],
      validationErrors: ['endpoint returns 404'],
    },
  ],
  taskLoopDetected: false,
});

// Inject at START of helper agent prompt
const promptWithContext = `${preContext}\n\n${helperAgentPrompt}`;
```

#### Point C: Retry After Validation Failure

When retrying a task after validation failure:

```typescript
// BEFORE retry prompt
const preContext = buildRetryContext({
  attemptNumber: 2,
  previousValidationErrors: [
    'Missing unit tests for auth service',
    'Test coverage below 80%',
  ],
  previousFiles: {
    created: ['src/auth/service.ts'],
    updated: ['src/index.ts'],
  },
});

// Inject at START of prompt
const promptWithContext = `${preContext}\n\n${originalPrompt}`;
```

### 2. Pre-Context Format (Strict <10 Lines)

**Circuit Breaker Context:**
```
--- PROVIDER SWITCH CONTEXT ---
Previous provider (gemini) failed: rate_limit_exceeded
Previous attempt created: src/auth/middleware.ts
Previous attempt modified: src/index.ts
Validation error: "auth routes not registered correctly"
Continue from where gemini left off. Avoid recreating existing files.
--- END CONTEXT ---
```

**Helper Agent Context:**
```
--- HELPER AGENT CONTEXT ---
Attempt #2 (1st retry) - previous validation failed
Attempt 1 created: src/routes/health.ts - error: "endpoint not registered"
Attempt 2 modified: src/index.ts - error: "endpoint returns 404"
Generate commands to verify route registration AND response validity
--- END CONTEXT ---
```

**Retry Context:**
```
--- RETRY CONTEXT ---
Attempt #2 - Previous validation failures:
- Missing unit tests for auth service
- Test coverage below 80%
Already created: src/auth/service.ts
Focus on: Adding unit tests to achieve 80%+ coverage
--- END CONTEXT ---
```

### 3. Implementation Architecture

#### 3.1. Execution Context Tracker

**Persistence Requirement**: The `ExecutionContext` MUST be persisted to DragonflyDB (e.g., as part of `SupervisorState` or a separate key) to ensure context survives supervisor restarts. In-memory only storage is insufficient.

Create new module to track execution history:

```typescript
// src/domain/executors/executionContext.ts

export interface AttemptRecord {
  attemptNumber: number;
  provider: Provider;
  timestamp: string;
  files_created: string[];
  files_updated: string[];
  status: 'completed' | 'failed';
  validationErrors?: string[];
  exitReason?: string; // 'circuit_breaker' | 'validation_failure' | 'execution_error'
}

export interface ExecutionContext {
  task_id: string;
  attempts: AttemptRecord[];
  current_attempt: number;
  last_provider?: Provider;
  last_validation_errors?: string[];
}

export class ExecutionContextManager {
  // In-memory cache backed by persistence
  private contexts: Map<string, ExecutionContext> = new Map();
  private persistence: PersistenceLayer; // Needs injection

  constructor(persistence: PersistenceLayer) {
    this.persistence = persistence;
  }

  async addAttempt(taskId: string, record: AttemptRecord): Promise<void> {
    let ctx = await this.getContext(taskId); // Load from DB if not in memory
    if (!ctx) {
      ctx = {
        task_id: taskId,
        attempts: [],
        current_attempt: 1,
      };
    }

    ctx.attempts.push(record);
    ctx.current_attempt = record.attemptNumber;
    ctx.last_provider = record.provider;
    ctx.last_validation_errors = record.validationErrors;
    
    this.contexts.set(taskId, ctx);
    await this.persistence.saveContext(taskId, ctx); // Persist immediately
  }

  async getContext(taskId: string): Promise<ExecutionContext | null> {
    if (this.contexts.has(taskId)) {
      return this.contexts.get(taskId)!;
    }
    // Fallback to DB load
    const ctx = await this.persistence.loadContext(taskId);
    if (ctx) {
      this.contexts.set(taskId, ctx);
    }
    return ctx;
  }

  async clearContext(taskId: string): Promise<void> {
    this.contexts.delete(taskId);
    await this.persistence.deleteContext(taskId);
  }
}
```

#### 3.2. Pre-Context Builders
// ... (same as before)

#### 3.3. Integration Points

**A. CLIAdapter Modification (Circuit Breaker Context)**
`CLIAdapter` manages the immediate fallback loop (Provider 1 -> Provider 2). It will inject the context *dynamically* between attempts within the same `execute` call.

**B. Control Loop Modification (Retry Context)**
`ControlLoop` manages the high-level retry loop (Attempt 1 -> Validation Fail -> Attempt 2). It will inject the context *before* calling `cliAdapter.execute`.

**C. Helper Agent Modification (Helper Context)**
`CommandGenerator` manages the helper invocation. It will inject the context.


```typescript
// src/infrastructure/adapters/agents/providers/cliAdapter.ts

export class CLIAdapter {
  private executionContextManager: ExecutionContextManager;

  constructor(redisClient: Redis, priority?: Provider[], ttlSeconds?: number) {
    this.executionContextManager = new ExecutionContextManager();
    // ... existing constructor
  }

  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string,
    taskId?: string // NEW: Pass task ID to track context
  ): Promise<ProviderResult> {
    let selectedProvider = await this.selectProvider();
    let attemptNumber = 1;

    // Get execution context for this task
    const execContext = taskId ? this.executionContextManager.getContext(taskId) : null;
    if (execContext) {
      attemptNumber = execContext.current_attempt + 1;
    }

    for (let i = this.priority.indexOf(selectedProvider); i < this.priority.length; i++) {
      const provider = this.priority[i];

      if (await this.circuitBreaker.isOpen(provider)) continue;

      try {
        // Inject pre-context if this is a fallback
        let contextualPrompt = prompt;
        if (i > 0 && execContext) {
          // This is a fallback (not first provider)
          const lastAttempt = execContext.attempts[execContext.attempts.length - 1];
          const preContext = buildCircuitBreakerContext(
            execContext.last_provider!,
            'circuit_breaker_triggered',
            lastAttempt
          );
          contextualPrompt = preContext + prompt;
        }

        const result = await this.executeProvider(provider, contextualPrompt, workingDirectory, agentMode, sessionId, featureId);

        // Track this attempt
        if (taskId) {
          this.executionContextManager.addAttempt(taskId, {
            attemptNumber,
            provider,
            timestamp: new Date().toISOString(),
            files_created: result.files_created || [],
            files_updated: result.files_updated || [],
            status: result.status === 'COMPLETED' ? 'completed' : 'failed',
            validationErrors: result.validationErrors,
            exitReason: result.status === 'FAILED' ? 'execution_error' : undefined,
          });
        }

        if (this.shouldTriggerCircuitBreaker(provider, result)) {
          await this.circuitBreaker.open(provider);
          continue;
        }

        return result;
      } catch (error) {
        // Track failed attempt
        if (taskId) {
          this.executionContextManager.addAttempt(taskId, {
            attemptNumber,
            provider,
            timestamp: new Date().toISOString(),
            files_created: [],
            files_updated: [],
            status: 'failed',
            exitReason: 'execution_error',
          });
        }
        // Try next provider
      }
    }

    // All providers failed
    return { status: 'FAILED', stderr: 'All providers circuit-broken' };
  }

  getExecutionContext(taskId: string): ExecutionContext | null {
    return this.executionContextManager.getContext(taskId);
  }

  clearExecutionContext(taskId: string): void {
    this.executionContextManager.clearContext(taskId);
  }
}
```

**B. Control Loop Modification (Retry Context)**

```typescript
// src/application/services/controlLoop.ts

async function executeTaskWithRetries(task: Task, ...): Promise<void> {
  let attemptNumber = 1;
  const maxRetries = task.retry_policy?.max_retries || 3;
  let previousValidationErrors: string[] = [];
  let previousFiles = { created: [], updated: [] };

  while (attemptNumber <= maxRetries) {
    // Build prompt with retry context
    let prompt = buildPrompt(task, minimalState);
    
    if (attemptNumber > 1) {
      // Inject retry context
      const retryContext = buildRetryContext(
        attemptNumber,
        previousValidationErrors,
        previousFiles
      );
      prompt = retryContext + prompt;
    }

    // Execute task
    const result = await cliAdapter.execute(prompt, sandboxCwd, agentMode, sessionId, featureId, task.task_id);

    // Validation
    const validationResult = await validateTaskCompletion(task, result, ...);

    if (validationResult.passed) {
      // Success - clear context
      cliAdapter.clearExecutionContext(task.task_id);
      return;
    }

    // Validation failed - track for next retry
    previousValidationErrors = validationResult.failedCriteria || [];
    previousFiles = {
      created: result.files_created || [],
      updated: result.files_updated || [],
    };

    attemptNumber++;
  }

  // Max retries exceeded
  throw new Error('Validation failed after max retries');
}
```

**C. Helper Agent Modification**

```typescript
// src/domain/executors/commandGenerator.ts

export async function generateValidationCommands(
  agentResponse: string,
  failedCriteria: string[],
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  helperAgentMode?: string,
  sandboxRoot?: string,
  projectId?: string,
  taskId?: string,
  sessionId?: string,
  featureId?: string
): Promise<CommandGenerationResult> {
  // Get execution context
  const execContext = taskId ? cliAdapter.getExecutionContext(taskId) : null;

  // Build helper agent context
  let preContext = '';
  if (execContext && execContext.attempts.length > 1) {
    preContext = buildHelperAgentContext(
      execContext.current_attempt,
      execContext.attempts.map(a => ({
        files_created: a.files_created,
        files_updated: a.files_updated,
        validationErrors: a.validationErrors || [],
      }))
    );
  }

  // Build prompt
  const basePrompt = buildEnhancedHelperAgentPrompt(agentResponse, failedCriteria, sandboxCwd, codeFiles);
  const prompt = preContext + basePrompt;

  // Execute helper agent
  const helperResult = await cliAdapter.execute(prompt, sandboxCwd, helperAgentMode, sessionId, featureId);

  // ... parse result
}
```

---

## Implementation Plan

### Phase 1: Execution Context Tracking (Week 1)

**Tasks:**
1. Create `ExecutionContextManager` class
2. Define `AttemptRecord` and `ExecutionContext` interfaces
3. Add context tracking to `CLIAdapter.execute()`
4. Add `taskId` parameter to `execute()` signature
5. Update all `execute()` call sites to pass `task.task_id`

**Acceptance Criteria:**
- [ ] Context manager tracks attempts per task
- [ ] Each provider fallback records an attempt
- [ ] Context persists across retries
- [ ] Context is cleared on task completion

### Phase 2: Pre-Context Builders (Week 1)

**Tasks:**
1. Create `preContextBuilder.ts` module
2. Implement `buildCircuitBreakerContext()`
3. Implement `buildRetryContext()`
4. Implement `buildHelperAgentContext()`
5. Add unit tests for each builder (verify <10 line limit)

**Acceptance Criteria:**
- [ ] All builders produce <10 lines of output
- [ ] Builders handle missing data gracefully (return empty string)
- [ ] Output format is clear and actionable
- [ ] Unit tests verify line count and content

### Phase 3: Integration (Week 2)

**Tasks:**
1. Modify `CLIAdapter` to inject circuit breaker context on fallback
2. Modify control loop to inject retry context on retries
3. Modify helper agent to inject attempt context
4. Update prompt logs to distinguish original vs contextual prompts
5. Add metrics: `context_injection_count{type="circuit_breaker|retry|helper"}`

**Acceptance Criteria:**
- [ ] Circuit breaker fallback injects context before switching provider
- [ ] Retry attempts inject context with previous validation errors
- [ ] Helper agent receives context about previous attempts
- [ ] Logs show contextual prompts separately
- [ ] Metrics track context injection usage

### Phase 4: Testing & Validation (Week 2)

**Tasks:**
1. Integration test: circuit breaker fallback with context
2. Integration test: retry with validation failure context
3. Integration test: helper agent with multi-attempt context
4. Manual test: run tasks7.json mobile project with context injection
5. Compare retry success rate before/after context injection

**Acceptance Criteria:**
- [ ] Integration tests pass with context injection enabled
- [ ] Retry success rate improves by 10%+ (measured on 20+ tasks)
- [ ] No regression in first-attempt success rate
- [ ] Context injection overhead <50ms per prompt

---

## Metrics & Success Criteria

### Primary Metrics

1. **Retry Success Rate (Post-Context)**
   - **Baseline:** ~60% (retries succeed after validation failure)
   - **Target:** 70-75% (10-15% improvement)
   - **Measurement:** Track validation pass rate on 2nd+ attempts

2. **Circuit Breaker Fallback Success Rate**
   - **Baseline:** ~50% (fallback provider succeeds)
   - **Target:** 60-65% (10-15% improvement)
   - **Measurement:** Track task completion rate when fallback provider is used

3. **Helper Agent Command Accuracy**
   - **Baseline:** ~75% (helper generates useful commands)
   - **Target:** 85-90% (10-15% improvement)
   - **Measurement:** Track validation pass rate after helper commands are executed

### Secondary Metrics

4. **Context Injection Overhead**
   - **Target:** <50ms per prompt
   - **Measurement:** Time to build and inject context

5. **Token Usage Impact**
   - **Target:** <100 tokens per context injection
   - **Measurement:** Count tokens in pre-context strings

6. **Validation Loop Convergence**
   - **Target:** 20% fewer total attempts to completion
   - **Measurement:** Average attempts per task (before/after)

---

## Edge Cases & Error Handling

### 1. Missing Execution Context

**Scenario:** Task is retried but no execution context exists (state cleared, crash, etc.)

**Handling:**
```typescript
const execContext = taskId ? executionContextManager.getContext(taskId) : null;
if (!execContext || execContext.attempts.length === 0) {
  // No context available - proceed without pre-context
  return '';
}
```

### 2. Context Exceeds 10 Lines

**Scenario:** Multiple retries generate >10 lines of context

**Handling:**
- Limit to **last 2 attempts** only
- Truncate file lists to **3 files max**
- Use single validation error (most recent)
- Enforce hard line limit in builders

```typescript
function buildRetryContext(...): string {
  const lines: string[] = [];
  // ... build context

  // Enforce 10-line limit
  if (lines.length > 10) {
    return lines.slice(0, 10).join('\n') + '\n--- CONTEXT TRUNCATED ---\n';
  }

  return lines.join('\n');
}
```

### 3. Corrupted or Invalid AttemptRecord

**Scenario:** AttemptRecord has missing/null fields

**Handling:**
- Use safe access: `previousAttempt?.files_created?.slice(0, 3) || []`
- Skip context if critical fields are missing
- Log warning but don't fail

### 4. Task Loop Detection

**Scenario:** Task retries 3+ times with same validation error

**Handling:**
- Detect in helper agent context builder
- Add special line: `Task appears stuck in validation loop - try different approach`
- Helper agent prompt includes loop detection hint

```typescript
function detectTaskLoop(attempts: AttemptRecord[]): boolean {
  if (attempts.length < 3) return false;

  const lastThree = attempts.slice(-3);
  const errors = lastThree.map(a => a.validationErrors?.[0] || '');

  // If all 3 have same error, it's a loop
  return errors[0] === errors[1] && errors[1] === errors[2];
}
```

---

## Configuration

### Environment Variables

```bash
# Enable/disable pre-context injection
ENABLE_PRE_CONTEXT_INJECTION=true  # Default: true

# Max lines for pre-context (hard limit)
PRE_CONTEXT_MAX_LINES=10  # Default: 10

# Include context types (comma-separated)
PRE_CONTEXT_TYPES=circuit_breaker,retry,helper  # Default: all

# Max attempts to include in helper agent context
HELPER_CONTEXT_MAX_ATTEMPTS=2  # Default: 2

# Max files to list in context
PRE_CONTEXT_MAX_FILES=3  # Default: 3
```

### Runtime Toggle

Allow runtime enable/disable per task:

```json
{
  "task_id": "mobile_expo_init",
  "instructions": "...",
  "options": {
    "enable_pre_context": true  // Override global config
  }
}
```

---

## Examples

### Example 1: Circuit Breaker Fallback

**Scenario:** Gemini hits rate limit mid-task, Copilot takes over

**Original Prompt (no context):**
```
## Task ID
mobile_icons_assets

## Task Description
Install/use @expo/vector-icons for icons. Use expo-image for performant images with placeholders...

## Intent
Set up icon library and handle image assets for mobile.

## Acceptance Criteria
- Icon library is configured and working
- All UI icons render correctly
...
```

**With Pre-Context Injection:**
```
--- PROVIDER SWITCH CONTEXT ---
Previous provider (gemini) failed: rate_limit_exceeded
Previous attempt created: app/config/icons.ts, app/components/Icon.tsx
Previous attempt modified: app.json
Validation error: "Splash screen not configured in app.json"
Continue from where gemini left off. Avoid recreating existing files.
--- END CONTEXT ---

## Task ID
mobile_icons_assets

## Task Description
Install/use @expo/vector-icons for icons. Use expo-image for performant images with placeholders...
...
```

**Expected Impact:** Copilot knows:
- Icons config already exists
- Icon component already created
- Focus on fixing splash screen configuration
- Don't recreate existing files

### Example 2: Retry After Validation Failure

**Scenario:** Task fails validation, retry with context

**Original Prompt (retry attempt 2, no context):**
```
## Task ID
api_fix_vehicle_listings

## Task Description
Review the vehicle listings aggregation and API endpoints. Fix data inconsistencies...

## Acceptance Criteria
- Vehicle listings API returns consistent, normalized data
- Pagination and filtering work as expected
...
```

**With Pre-Context Injection:**
```
--- RETRY CONTEXT ---
Attempt #2 - Previous validation failures:
- Vehicle listings API returns inconsistent price formats (string vs number)
- Pagination total count is null in response
Already created: src/services/vehicleService.ts
Already modified: src/routes/vehicles.ts
Focus on fixing validation failures listed above.
--- END CONTEXT ---

## Task ID
api_fix_vehicle_listings

## Task Description
Review the vehicle listings aggregation and API endpoints. Fix data inconsistencies...
...
```

**Expected Impact:** Agent knows:
- Specific issues: price format + null total count
- Service file already exists (don't recreate)
- Focus on price normalization and pagination metadata

### Example 3: Helper Agent with Multi-Attempt Context

**Scenario:** Helper agent invoked on 3rd attempt

**Original Helper Prompt (no context):**
```
## Enhanced Verification Task
You are a Helper Agent. Your task is to VERIFY, not assume.

**Failed Criteria:**
1. React Navigation is installed and configured
2. Bottom tab navigation is working with 4 tabs

**Agent Response:**
I have installed React Navigation and configured tab navigation...
```

**With Pre-Context Injection:**
```
--- HELPER AGENT CONTEXT ---
Attempt #3 (2 previous retries) - validation failed
Attempt 1 touched: app/navigation/types.ts - error: "Navigation types not properly defined"
Attempt 2 touched: app/navigation/TabNavigator.tsx - error: "Bottom tab navigation not working"
Generate commands to verify ALL failed criteria from ALL attempts.
--- END CONTEXT ---

## Enhanced Verification Task
You are a Helper Agent. Your task is to VERIFY, not assume.
...
```

**Expected Impact:** Helper agent knows:
- This is 3rd attempt (task might be stuck)
- Types were already attempted (check if they exist)
- Tab navigator was already modified (focus on runtime behavior, not existence)
- Generate commands to verify **both** typing AND navigation runtime

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Context confuses agent** | High | Low | Test extensively; make context ultra-concise; use clear delimiters |
| **Context exceeds 10 lines** | Medium | Medium | Enforce hard line limit; truncate if needed; prioritize recent attempts |
| **Context adds latency** | Low | Low | Pre-context building <50ms; negligible vs provider API call (1-5s) |
| **Context increases token cost** | Low | Medium | ~50-100 tokens per context; acceptable for 10-15% success rate gain |
| **Stale context (cached)** | High | Low | Clear context on task completion; regenerate on each attempt |

---

## Alternatives Considered

### 1. **Session-Based Context (Using Provider Session IDs)**

**Approach:** Use provider's native session feature (e.g., Gemini `--session-id`) to maintain conversation history

**Pros:**
- Provider handles context automatically
- No extra prompt engineering needed
- Full conversation history available

**Cons:**
- ❌ Doesn't work across providers (can't transfer Gemini session to Copilot)
- ❌ No control over what context is retained
- ❌ May include irrelevant context (bloats prompt)
- ❌ Not all providers support sessions

**Verdict:** ❌ Not suitable for circuit breaker fallback (can't transfer sessions between providers)

### 2. **Full Execution Log in State**

**Approach:** Store full execution log in DragonflyDB state, inject entire log into prompt

**Pros:**
- Complete history available
- Easy to implement (append to state)

**Cons:**
- ❌ State bloat (logs grow indefinitely)
- ❌ Prompt bloat (entire log may be 100+ lines)
- ❌ Too much context (agent overwhelmed)
- ❌ High token cost

**Verdict:** ❌ Too verbose; violates <10 line constraint

### 3. **No Context (Current Approach)**

**Approach:** Keep current behavior - no context injection

**Pros:**
- ✅ Simple, no new code
- ✅ No risk of confusing agent with context
- ✅ Zero overhead

**Cons:**
- ❌ Agents repeat mistakes (no learning from previous attempts)
- ❌ Wasted retries (same validation error 2-3 times)
- ❌ Poor fallback experience (fallback agent starts from scratch)

**Verdict:** ❌ Current approach is suboptimal; 10-15% improvement is worth the effort

---

## Future Enhancements (Beyond Scope)

### 1. **Context Compression via Embeddings**

Use embeddings to compress execution history into semantic vector, pass to agent via RAG

**Benefit:** More context in fewer tokens  
**Complexity:** High (requires vector DB, embedding model)  
**Priority:** Low (defer to future)

### 2. **Agent-to-Agent Handoff Protocol**

Formalize handoff between providers with structured metadata

**Benefit:** Better provider interoperability  
**Complexity:** Medium (requires provider API changes)  
**Priority:** Low (pre-context injection is sufficient)

### 3. **LLM-Generated Context Summaries**

Use separate LLM call to summarize execution history into <10 lines

**Benefit:** More intelligent context (vs deterministic)  
**Complexity:** Medium (adds LLM call latency)  
**Priority:** Low (deterministic approach is faster + cheaper)

---

## Success Metrics (6 Week Post-Launch)

1. **Retry Success Rate:** 70%+ (from 60% baseline)
2. **Circuit Breaker Fallback Success:** 62%+ (from 50% baseline)
3. **Helper Agent Accuracy:** 85%+ (from 75% baseline)
4. **Context Injection Overhead:** <50ms average
5. **Token Cost Increase:** <5% (50-100 tokens per context)
6. **Validation Loop Convergence:** 15-20% fewer attempts per task

---

## Recommendation

✅ **PROCEED WITH IMPLEMENTATION**

**Justification:**
- **High ROI:** 10-15% improvement in retry/fallback success rates
- **Low Risk:** Pre-context is isolated, can be disabled via flag
- **Low Complexity:** ~2 weeks implementation (context tracking + builders + integration)
- **Clear Benefits:** Reduces wasted retries, improves agent continuity, better validation outcomes

**Implementation Priority:** **Medium** (after helper-agent-optimization Phase 1-4, can run in parallel with helper-agent-local-model)

---

## Next Steps

1. **Create GitHub Issue:** "Feature: Pre-Context Injection for Agent Switching"
2. **Prototype Context Builders:** Test 10-line format on 10+ real scenarios
3. **Validate with Production Data:** Replay failed tasks with context injection, measure improvement
4. **Implement Phase 1:** Execution context tracking (1 week)
5. **User Testing:** Enable for 5-10 tasks, gather feedback on context clarity

---

## References

- [CLIAdapter Implementation](../../src/infrastructure/adapters/agents/providers/cliAdapter.ts)
- [Prompt Builder](../../src/domain/agents/promptBuilder.ts)
- [Helper Agent Prompt](../../src/domain/executors/commandGenerator.ts)
- [Circuit Breaker Manager](../../src/infrastructure/network/resilience/circuitBreaker.ts)
- [Control Loop](../../src/application/services/controlLoop.ts)
- [Helper Agent Optimization Plan](./helper-agent-optimization.md)

---

## Appendix: Context Format Specification

### Circuit Breaker Context (Max 8 Lines)

```
--- PROVIDER SWITCH CONTEXT ---
Previous provider (<provider>) failed: <reason>
[Previous attempt created: <file1>, <file2>, <file3>]  // Optional, max 3 files
[Previous attempt modified: <file1>, <file2>, <file3>]  // Optional, max 3 files
[Validation error: "<error>"]  // Optional, first error only
Continue from where <provider> left off. Avoid recreating existing files.
--- END CONTEXT ---
<blank line>
```

### Retry Context (Max 9 Lines)

```
--- RETRY CONTEXT ---
Attempt #<N> - Previous validation failures:
- <error1>
- <error2>
- <error3>  // Max 3 errors
[Already created: <file1>, <file2>, <file3>]  // Optional, max 3 files
[Already modified: <file1>, <file2>, <file3>]  // Optional, max 3 files
Focus on fixing validation failures listed above.
--- END CONTEXT ---
<blank line>
```

### Helper Agent Context (Max 8 Lines)

```
--- HELPER AGENT CONTEXT ---
Attempt #<N> (<N-1> previous retries) - validation failed
Attempt <N-1> [touched: <files>] - error: "<error>"  // Last 2 attempts
Attempt <N-2> [touched: <files>] - error: "<error>"
[Task appears stuck in validation loop - try different approach]  // Optional loop warning
Generate commands to verify ALL failed criteria from ALL attempts.
--- END CONTEXT ---
<blank line>
```

### Line Budget Allocation

- **Circuit Breaker:** 6-8 lines (delimiter + provider + files + error + instruction)
- **Retry:** 7-9 lines (delimiter + errors + files + instruction)
- **Helper Agent:** 6-8 lines (delimiter + attempt history + instruction)
- **Hard Limit:** 10 lines max (enforced via truncation)
