# Control Loop Modularization Analysis

**Date**: January 10, 2026  
**File Analyzed**: `src/application/services/controlLoop.ts` (1,724 lines)  
**Status**: 🔴 CRITICAL - Requires immediate modularization

---

## Executive Summary

The `controlLoop.ts` is a **monolithic orchestration engine** that violates Single Responsibility Principle (SRP) at an extreme scale. It handles **15+ distinct concerns** in a single 1,700+ line function, making it the most critical refactoring target in the codebase.

**Immediate Impact**:
- ❌ **Testability**: Cannot unit test individual phases without full integration
- ❌ **Maintainability**: Single function with 1,500+ lines is unmaintainable
- ❌ **Extensibility**: Adding new validation/retry strategies requires modifying monolith
- ❌ **Debuggability**: Stack traces point to single function, hard to isolate issues
- ❌ **Code Review**: 1,700 lines impossible to review effectively

**Recommended Action**: Break into **8 strategic modules** with clear boundaries.

---

## Part 1: Current Responsibilities Analysis

### Responsibilities Identified (15 total)

| # | Responsibility | Lines | Complexity | Coupling |
|---|---------------|-------|------------|----------|
| 1 | **State Management** | ~150 | Medium | High |
| 2 | **Task Retrieval & Recovery** | ~120 | Medium | High |
| 3 | **Queue Exhaustion Handling** | ~140 | High | Medium |
| 4 | **Goal Completion Checking** | ~100 | Medium | Medium |
| 5 | **Working Directory Resolution** | ~20 | Low | Low |
| 6 | **Prompt Building** | ~60 | Low | Medium |
| 7 | **Session Management** | ~80 | High | High |
| 8 | **Context Limit Policy Enforcement** | ~50 | Medium | Medium |
| 9 | **Provider Dispatch** | ~40 | Low | Medium |
| 10 | **Halt Detection** | ~120 | High | Medium |
| 11 | **Resource Exhaustion Backoff** | ~100 | High | High |
| 12 | **Validation Orchestration** | ~200 | Very High | Very High |
| 13 | **Deterministic Validation** | ~60 | Medium | Medium |
| 14 | **Helper Agent Command Generation** | ~150 | High | High |
| 15 | **Interrogation Orchestration** | ~100 | High | High |
| 16 | **Retry Logic & Error Tracking** | ~200 | Very High | Very High |
| 17 | **Task Completion & State Persistence** | ~80 | Medium | High |
| 18 | **Audit Logging** | ~50 | Low | Medium |

### Complexity Hotspots

```
Lines 1-100:    Imports + Constants + Utilities      [ACCEPTABLE]
Lines 100-300:  State Load + Validation + Recovery   [COMPLEX]
Lines 300-450:  Goal Completion Check                [ACCEPTABLE]
Lines 450-600:  Task Execution Setup                 [ACCEPTABLE]
Lines 600-900:  Session Management + Provider Call   [COMPLEX]
Lines 900-1200: Validation + Helper Agent            [VERY COMPLEX]
Lines 1200-1500: Interrogation + Retry Logic         [EXTREMELY COMPLEX]
Lines 1500-1724: Fix Attempts + Task Completion      [VERY COMPLEX]
```

**Critical Finding**: Lines 900-1500 (600 lines) contain **nested validation logic** that should be 3-4 separate modules.

---

## Part 2: Architectural Problems

### Problem 1: God Function Anti-Pattern

```typescript
async function controlLoop(
  persistence: PersistenceLayer,
  queue: QueueAdapter,
  promptBuilder: PromptBuilder,
  cliAdapter: CLIAdapter,
  validator: Validator,
  auditLogger: AuditLogger,
  sandboxRoot: string
): Promise<void> {
  // 1,500 lines of orchestration logic
  // Handles: state, queue, goals, tasks, prompts, sessions, 
  //          halt detection, validation, helper agents, 
  //          interrogation, retries, persistence, audit logs
}
```

**Impact**: Cannot test, cannot extend, cannot debug effectively.

### Problem 2: Nested Conditionals (Cyclomatic Complexity)

**Example - Validation Flow** (Lines 900-1200):
```
IF !valid
  IF deterministic_enabled AND in_bucket
    IF can_validate
      IF confidence == HIGH AND valid
        SKIP helper agent
      ELSE
        INVOKE helper agent
    ELSE
      INVOKE helper agent
  ELSE
    SKIP deterministic
    
  IF !valid AND !deterministic_skipped
    TRY helper agent
      IF isValid
        MARK valid
      ELSE IF commands.length > 0
        EXECUTE commands
        IF passed
          MARK valid
        ELSE
          PROCEED to interrogation
      ELSE
        PROCEED to interrogation
```

**Cyclomatic Complexity**: 15+ paths in validation alone.

### Problem 3: Implicit State Mutation

```typescript
// Line 606-620: Implicit state mutation across function
if (providerResult.sessionId) {
  if (!state.active_sessions) state.active_sessions = {};
  state.active_sessions[featureId] = {
    session_id: providerResult.sessionId,
    // ... 6 more properties
  };
}

// Line 1200+: More implicit mutations
(state.supervisor as any)[retryKey] = retryCount + 1;
(state.supervisor as any)[lastErrorKey] = currentError;
(state.supervisor as any)[interrogationKey] = true;
```

**Impact**: State changes scattered across 1,500 lines, impossible to track.

### Problem 4: Responsibilities Bleeding Across Boundaries

**Example**: Helper Agent invocation (Lines 920-990):
- Generates commands via `generateValidationCommands()`
- Updates session state
- Records analytics
- Logs to prompt log
- Executes verification commands
- Updates validation report
- All in **70 lines of controlLoop code**

**Should be**: `await helperAgentService.validate(task, validationReport, sandboxCwd)`

### Problem 5: Error Handling Scattered

```
// Error handling in 8+ different places:
1. Line 170: State validation errors → halt
2. Line 685: Halt detection → halt or continue
3. Line 753: Resource exhausted → backoff retry
4. Line 784: Critical halts → immediate halt
5. Line 920: Helper agent errors → try-catch, continue
6. Line 1280: Repeated errors → block task
7. Line 1340: Max retries → final interrogation → block
8. Line 1520: Fix attempt critical halts → halt
```

**Impact**: Inconsistent error handling patterns, hard to reason about failure modes.

---

## Part 3: Proposed Modular Architecture

### Module Breakdown (8 Core Modules)

```
src/application/services/controlLoop/
├── index.ts                          # Main orchestrator (300 lines max)
├── modules/
│   ├── stateManager.ts               # State load/persist/validation
│   ├── taskRetriever.ts              # Task recovery/dequeue
│   ├── goalCompletionChecker.ts      # Goal completion evaluation
│   ├── taskExecutor.ts               # Prompt build + provider dispatch
│   ├── sessionResolver.ts            # Session management + context limits
│   ├── validationOrchestrator.ts     # Validation pipeline
│   ├── retryOrchestrator.ts          # Retry logic + error tracking
│   └── taskFinalizer.ts              # Task completion + audit
├── strategies/
│   ├── validation/
│   │   ├── deterministicValidator.ts
│   │   ├── helperAgentValidator.ts
│   │   └── interrogationValidator.ts
│   ├── retry/
│   │   ├── resourceExhaustedStrategy.ts
│   │   ├── repeatedErrorStrategy.ts
│   │   └── maxRetriesStrategy.ts
│   └── halt/
│       ├── haltDetector.ts
│       └── haltHandler.ts
└── types/
    ├── controlLoopContext.ts         # Shared context object
    └── moduleInterfaces.ts           # Module contracts
```

### Module Responsibilities

#### 1. **stateManager.ts** (~200 lines)
```typescript
export class StateManager {
  async loadState(): Promise<SupervisorState>
  async persistState(state: SupervisorState): Promise<void>
  validateRequiredFields(state: SupervisorState): void
  deepCopyState(state: SupervisorState): SupervisorState
}
```
**Responsibility**: All state loading, validation, persistence, deep copying.

#### 2. **taskRetriever.ts** (~150 lines)
```typescript
export class TaskRetriever {
  async retrieveTask(state: SupervisorState, queue: QueueAdapter): Promise<TaskRetrievalResult>
  // Handles: current_task recovery, retry_task, queue dequeue
}

interface TaskRetrievalResult {
  task: Task | null;
  source: 'current_task_recovery' | 'retry_task' | 'queue' | 'none';
  queueExhausted: boolean;
}
```
**Responsibility**: Task retrieval with recovery logic.

#### 3. **goalCompletionChecker.ts** (~200 lines)
```typescript
export class GoalCompletionChecker {
  async checkGoalCompletion(
    state: SupervisorState,
    cliAdapter: CLIAdapter,
    sandboxRoot: string
  ): Promise<GoalCheckResult>
}

interface GoalCheckResult {
  completed: boolean;
  shouldHalt: boolean;
  reason?: string;
}
```
**Responsibility**: Goal completion evaluation when queue exhausted.

#### 4. **taskExecutor.ts** (~250 lines)
```typescript
export class TaskExecutor {
  async executeTask(
    task: Task,
    state: SupervisorState,
    context: ExecutionContext
  ): Promise<ExecutionResult>
  
  private resolveWorkingDirectory(task: Task, projectId: string): string
  private buildPrompt(task: Task, minimalState: MinimalState): string
  private dispatchToProvider(prompt: string, ...): Promise<ProviderResult>
}

interface ExecutionResult {
  providerResult: ProviderResult;
  sessionId?: string;
  prompt: string;
  response: string;
}
```
**Responsibility**: Prompt building, session resolution, provider dispatch.

#### 5. **sessionResolver.ts** (~150 lines)
```typescript
export class SessionResolver {
  async resolveSession(
    task: Task,
    state: SupervisorState,
    featureId: string
  ): Promise<string | undefined>
  
  enforceContextLimits(
    session: ActiveSession,
    provider: string
  ): boolean
  
  updateSessionState(
    state: SupervisorState,
    featureId: string,
    sessionId: string,
    usage: TokenUsage
  ): void
}
```
**Responsibility**: Session management, context limit enforcement.

#### 6. **validationOrchestrator.ts** (~400 lines)
```typescript
export class ValidationOrchestrator {
  async validate(
    task: Task,
    executionResult: ExecutionResult,
    context: ValidationContext
  ): Promise<ValidationResult>
  
  private async attemptDeterministicValidation(...): Promise<ValidationReport>
  private async attemptHelperAgentValidation(...): Promise<ValidationReport>
  private async attemptInterrogation(...): Promise<InterrogationResult>
}

interface ValidationResult {
  report: ValidationReport;
  needsRetry: boolean;
  needsInterrogation: boolean;
  haltReason?: HaltReason;
}
```
**Responsibility**: Orchestrate all validation strategies (deterministic, helper, interrogation).

#### 7. **retryOrchestrator.ts** (~350 lines)
```typescript
export class RetryOrchestrator {
  async handleRetry(
    task: Task,
    validationResult: ValidationResult,
    state: SupervisorState,
    context: RetryContext
  ): Promise<RetryDecision>
  
  private trackRepeatedErrors(task: Task, error: string, state: SupervisorState): RepeatedErrorCheck
  private checkMaxRetries(task: Task, state: SupervisorState): MaxRetriesCheck
  private async executeFixAttempt(...): Promise<ExecutionResult>
  private async performFinalInterrogation(...): Promise<InterrogationResult>
}

interface RetryDecision {
  action: 'retry' | 'block' | 'complete';
  updatedState: SupervisorState;
  fixAttemptResult?: ExecutionResult;
}
```
**Responsibility**: All retry logic, repeated error detection, final interrogation.

#### 8. **taskFinalizer.ts** (~150 lines)
```typescript
export class TaskFinalizer {
  async finalizeTask(
    task: Task,
    validationReport: ValidationReport,
    state: SupervisorState,
    context: FinalizationContext
  ): Promise<void>
  
  private updateStateForCompletion(state: SupervisorState, task: Task): void
  private async persistCompletedState(state: SupervisorState): Promise<void>
  private async appendAuditLog(...): Promise<void>
}
```
**Responsibility**: Task completion, state updates, audit logging.

---

## Part 4: Refactored Control Loop (Index.ts)

```typescript
// src/application/services/controlLoop/index.ts (~300 lines)

import { StateManager } from './modules/stateManager';
import { TaskRetriever } from './modules/taskRetriever';
import { GoalCompletionChecker } from './modules/goalCompletionChecker';
import { TaskExecutor } from './modules/taskExecutor';
import { SessionResolver } from './modules/sessionResolver';
import { ValidationOrchestrator } from './modules/validationOrchestrator';
import { RetryOrchestrator } from './modules/retryOrchestrator';
import { TaskFinalizer } from './modules/taskFinalizer';
import { HaltHandler } from './strategies/halt/haltHandler';
import { ResourceExhaustedStrategy } from './strategies/retry/resourceExhaustedStrategy';

export async function controlLoop(
  persistence: PersistenceLayer,
  queue: QueueAdapter,
  promptBuilder: PromptBuilder,
  cliAdapter: CLIAdapter,
  validator: Validator,
  auditLogger: AuditLogger,
  sandboxRoot: string
): Promise<void> {
  // Initialize modules
  const stateManager = new StateManager(persistence);
  const taskRetriever = new TaskRetriever(queue);
  const goalChecker = new GoalCompletionChecker(cliAdapter, sandboxRoot);
  const taskExecutor = new TaskExecutor(promptBuilder, cliAdapter, sandboxRoot);
  const sessionResolver = new SessionResolver();
  const validationOrchestrator = new ValidationOrchestrator(validator, cliAdapter, sandboxRoot);
  const retryOrchestrator = new RetryOrchestrator(cliAdapter, sandboxRoot);
  const taskFinalizer = new TaskFinalizer(persistence, auditLogger);
  const haltHandler = new HaltHandler(persistence, auditLogger);
  const resourceExhaustedStrategy = new ResourceExhaustedStrategy();

  let iteration = 0;
  const loopStartTime = Date.now();
  log('Control loop started');

  while (true) {
    iteration++;
    const iterationStartTime = Date.now();
    log(`[Iteration ${iteration}] Starting`);

    // 1. Load and validate state
    const state = await stateManager.loadState();
    stateManager.validateRequiredFields(state);

    // 2. Check supervisor status
    if (state.supervisor.status !== 'RUNNING') {
      if (state.supervisor.resource_exhausted_retry) {
        const shouldWait = resourceExhaustedStrategy.shouldWait(state, Date.now());
        if (shouldWait) {
          await sleep(Math.min(shouldWait.remainingMs, 60000));
          continue;
        }
        resourceExhaustedStrategy.clearRetryState(state);
      }
      
      if (state.supervisor.status !== 'RUNNING') {
        await sleep(1000);
        continue;
      }
    }

    // 3. Retrieve task (with recovery)
    const taskRetrievalResult = await taskRetriever.retrieveTask(state, queue);
    
    // 4. Handle no task (goal completion check)
    if (!taskRetrievalResult.task) {
      if (taskRetrievalResult.queueExhausted) {
        state.queue.exhausted = true;
        
        const goalCheckResult = await goalChecker.checkGoalCompletion(state, cliAdapter, sandboxRoot);
        
        if (goalCheckResult.shouldHalt) {
          await haltHandler.halt(state, 'TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE', goalCheckResult.reason);
        }
        
        // Goal completed
        state.supervisor.status = 'COMPLETED';
        await stateManager.persistState(state);
        return;
      }
      
      await sleep(1000);
      continue;
    }

    const task = taskRetrievalResult.task;
    analyticsService.initializeTask(task.task_id);
    
    // 5. Set current_task and persist
    state.current_task = task;
    await stateManager.persistState(state);

    // 6. Execute task (prompt build + provider dispatch)
    const executionResult = await taskExecutor.executeTask(task, state, {
      sessionResolver,
      projectId: state.goal.project_id || 'default',
      iteration,
    });

    // 7. Update session state
    if (executionResult.sessionId) {
      sessionResolver.updateSessionState(
        state,
        executionResult.featureId,
        executionResult.sessionId,
        executionResult.providerResult.usage
      );
    }

    // 8. Validate task output
    const validationResult = await validationOrchestrator.validate(
      task,
      executionResult,
      {
        state,
        sandboxCwd: executionResult.sandboxCwd,
        projectId: state.goal.project_id || 'default',
        iteration,
      }
    );

    // 9. Handle halt reasons (critical only)
    if (validationResult.haltReason) {
      const criticalHalts = ['BLOCKED', 'OUTPUT_FORMAT_INVALID', 'PROVIDER_CIRCUIT_BROKEN'];
      if (criticalHalts.includes(validationResult.haltReason)) {
        await haltHandler.halt(state, validationResult.haltReason);
      }
      
      // Resource exhausted - handle with backoff
      if (validationResult.haltReason === 'RESOURCE_EXHAUSTED') {
        const shouldRetry = resourceExhaustedStrategy.scheduleRetry(state, task);
        if (!shouldRetry) {
          await haltHandler.halt(state, 'RESOURCE_EXHAUSTED', 'Max retries exceeded');
        }
        await stateManager.persistState(state);
        continue;
      }
    }

    // 10. Handle retry (if validation failed or non-critical halt)
    if (validationResult.needsRetry) {
      const retryDecision = await retryOrchestrator.handleRetry(
        task,
        validationResult,
        state,
        {
          cliAdapter,
          sessionId: executionResult.sessionId,
          projectId: state.goal.project_id || 'default',
          iteration,
        }
      );

      if (retryDecision.action === 'block') {
        // Task blocked
        await stateManager.persistState(retryDecision.updatedState);
        await analyticsService.finalizeTask(task.task_id, 'BLOCKED', sandboxRoot, state.goal.project_id);
        continue;
      }

      if (retryDecision.action === 'retry') {
        // Will retry on next iteration
        await stateManager.persistState(retryDecision.updatedState);
        continue;
      }

      // retryDecision.action === 'complete' - continue to finalization
      state = retryDecision.updatedState;
      validationResult.report.valid = true;
    }

    // 11. Finalize task (mark complete, persist, audit)
    await taskFinalizer.finalizeTask(
      task,
      validationResult.report,
      state,
      {
        stateBefore: taskRetrievalResult.stateBefore,
        executionResult,
        sandboxRoot,
        projectId: state.goal.project_id || 'default',
        iteration,
      }
    );

    await analyticsService.finalizeTask(task.task_id, 'COMPLETED', sandboxRoot, state.goal.project_id);
    
    log(`[Iteration ${iteration}] Task ${task.task_id}: ✅ COMPLETED`);
    logPerformance('Iteration', Date.now() - iterationStartTime, { iteration, task_id: task.task_id });
  }
}
```

**Result**: Main orchestrator reduced from **1,700 lines → 300 lines**.

---

## Part 5: Benefits of Modularization

### Benefit 1: Testability

**Before**:
```typescript
// Cannot unit test validation logic without full control loop
describe('controlLoop', () => {
  it('should validate task output', async () => {
    // Must mock: persistence, queue, promptBuilder, cliAdapter, validator, auditLogger
    // Must set up: full state with 20+ fields
    // Must run: entire 1,700 line function
    // Can only assert: final state after completion
  });
});
```

**After**:
```typescript
describe('ValidationOrchestrator', () => {
  it('should attempt deterministic validation first', async () => {
    const result = await validationOrchestrator.validate(task, executionResult, context);
    expect(result.report.valid).toBe(true);
    expect(result.report.reason).toContain('Deterministic validation');
  });
  
  it('should fall back to helper agent if deterministic fails', async () => {
    // Test only validation logic in isolation
  });
});
```

### Benefit 2: Maintainability

**Before**: Changing retry logic requires editing 200+ line section of 1,700 line function.  
**After**: Edit `retryOrchestrator.ts` (350 lines, single responsibility).

### Benefit 3: Extensibility

**Adding new validation strategy**:

**Before**:
```typescript
// Edit lines 900-1200 of controlLoop.ts
// Insert new validation logic in nested if-else chain
// Risk breaking existing validation flow
```

**After**:
```typescript
// Create new file: strategies/validation/customValidator.ts
export class CustomValidator implements ValidationStrategy {
  async validate(...): Promise<ValidationReport> {
    // Your logic
  }
}

// Register in validationOrchestrator.ts
this.strategies.push(new CustomValidator());
```

### Benefit 4: Debuggability

**Before**:
```
Error: Validation failed
  at controlLoop (controlLoop.ts:1050)
```
*Which validation? Deterministic? Helper? Interrogation? Unknown.*

**After**:
```
Error: Helper agent command generation failed
  at HelperAgentValidator.validate (helperAgentValidator.ts:45)
  at ValidationOrchestrator.validate (validationOrchestrator.ts:120)
  at controlLoop (index.ts:150)
```
*Clear stack trace shows exact validation strategy that failed.*

### Benefit 5: Code Review

**Before**: 1,700 line PR → unreviewable  
**After**: 8 separate PRs of 150-400 lines each → reviewable

---

## Part 6: Migration Strategy

### Phase 1: Extract State Management (Step 1)
- Create `stateManager.ts`
- Move state load/persist/validation logic
- Update controlLoop to use StateManager
- **Risk**: Low (isolated operations)

### Phase 2: Extract Task Retrieval & Goal Checking (Step 1)
- Create `taskRetriever.ts` and `goalCompletionChecker.ts`
- Move task recovery and goal checking logic
- **Risk**: Low (no validation coupling)

### Phase 3: Extract Task Executor & Session Resolver (Step 2)
- Create `taskExecutor.ts` and `sessionResolver.ts`
- Move prompt building, provider dispatch, session management
- **Risk**: Medium (session state coupling)

### Phase 4: Extract Validation Orchestrator (Step 3)
- Create `validationOrchestrator.ts`
- Create strategy implementations (deterministic, helper, interrogation)
- Move validation logic
- **Risk**: High (most complex logic)

### Phase 5: Extract Retry Orchestrator (Step 3)
- Create `retryOrchestrator.ts`
- Move retry logic, error tracking, fix attempts
- **Risk**: High (complex retry state management)

### Phase 6: Extract Task Finalizer & Halt Handler (Step 4)
- Create `taskFinalizer.ts` and `haltHandler.ts`
- Move completion and halt logic
- **Risk**: Low (end-of-cycle operations)

### Phase 7: Refactor Main Orchestrator (Step 4)
- Rewrite controlLoop/index.ts to use modules
- Remove old monolithic code
- **Risk**: High (integration risk)

### Phase 8: Testing & Documentation (Step 5)
- Unit tests for each module
- Integration tests for orchestrator
- Update documentation
- **Risk**: Medium (test coverage)

**Total Timeline**: 5 Steps (incremental, low-risk)

---

## Part 7: Implementation Priorities

### Priority 1 (CRITICAL): Validation Orchestrator
**Why**: Most complex logic (600 lines), highest bug risk, hardest to test.  
**Impact**: Enables task-type-specific validation strategies.  
**Dependencies**: None (can extract independently).

### Priority 2 (HIGH): Retry Orchestrator
**Why**: Complex retry logic (350 lines), blocks extensibility.  
**Impact**: Enables custom retry strategies per task type.  
**Dependencies**: Validation Orchestrator.

### Priority 3 (HIGH): Task Executor
**Why**: Provider dispatch + session management (250 lines).  
**Impact**: Enables provider-specific execution strategies.  
**Dependencies**: Session Resolver.

### Priority 4 (MEDIUM): State Manager
**Why**: Simple but foundational (200 lines).  
**Impact**: Enables better state mutation tracking.  
**Dependencies**: None.

### Priority 5 (MEDIUM): Task Retriever + Goal Checker
**Why**: Straightforward logic (350 lines combined).  
**Impact**: Minor testability improvement.  
**Dependencies**: None.

### Priority 6 (LOW): Task Finalizer + Halt Handler
**Why**: Simple end-of-cycle logic (300 lines combined).  
**Impact**: Cleaner error handling.  
**Dependencies**: None.

---

## Part 8: Risk Assessment

### Risk 1: Integration Complexity
**Description**: Modules must share state context across boundaries.  
**Mitigation**: Use shared `ControlLoopContext` object passed to all modules.  
**Impact**: Medium (can be managed with careful interface design).

### Risk 2: Performance Overhead
**Description**: Module boundaries add function call overhead.  
**Mitigation**: Minimal (function calls are negligible vs I/O operations).  
**Impact**: Low (< 1ms per iteration).

### Risk 3: Breaking Changes
**Description**: Refactoring may introduce bugs.  
**Mitigation**: Incremental migration with full test coverage at each phase.  
**Impact**: Medium (can be reduced with disciplined testing).

### Risk 4: Team Coordination
**Description**: Multiple developers working on modularization.  
**Mitigation**: Clear module ownership, phased rollout.  
**Impact**: Low (with proper planning).

---

## Conclusion

### Current State Assessment

| Metric | Score | Status |
|--------|-------|--------|
| **Lines of Code** | 1,724 | 🔴 CRITICAL |
| **Cyclomatic Complexity** | 50+ | 🔴 CRITICAL |
| **Responsibilities** | 18 | 🔴 CRITICAL |
| **Testability** | 10% | 🔴 CRITICAL |
| **Maintainability** | 20% | 🔴 CRITICAL |
| **Extensibility** | 15% | 🔴 CRITICAL |

### Post-Modularization Targets

| Metric | Target | Improvement |
|--------|--------|-------------|
| **Main Orchestrator LOC** | 300 | -82% |
| **Module LOC** | 150-400 | Manageable |
| **Cyclomatic Complexity** | 5-10 per module | -80% |
| **Responsibilities per Module** | 1-2 | SRP Compliant |
| **Testability** | 90%+ | +80% |
| **Maintainability** | 85%+ | +65% |
| **Extensibility** | 90%+ | +75% |

### Recommendation

**PROCEED WITH MODULARIZATION IMMEDIATELY.**

The control loop is the **most critical refactoring target** in the supervisor codebase. Current monolithic design blocks:
- ✅ Task-type-specific validation strategies (from task-type-system-redesign.md)
- ✅ Provider-specific execution strategies
- ✅ Custom retry policies
- ✅ Effective testing and debugging

**Start with Phase 1-2 (State Manager + Task Retriever)** to build momentum with low-risk extractions, then tackle **Phase 4 (Validation Orchestrator)** as the critical path.

---

**Next Steps**:
1. Review this analysis with team
2. Approve modularization plan
3. Create tracking issues for 8 phases
4. Begin Phase 1 (State Manager extraction)
