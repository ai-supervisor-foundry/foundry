---
title: V2 Architecture Implementation Status & Gap Analysis
date: 2026-03-18
status: Active Review
---

# V2 Architecture Implementation Status

## Executive Summary

**Overall Status:** ~60% Implemented, 2 Modules Complete, 2 Partial, 1 Dropped

The Foundry V2 architecture outlined in `docs/plans/v2-architecture/` has significant progress:
- ✅ **Parallel Scheduler** (02) fully implemented
- ✅ **Model Routing** (05) complete via existing strategy chains
- ⚠️ **Safety Layer** (01) ~20% — basic validation, missing middleware pipeline
- ⚠️ **Hybrid Memory** (04) ~30% — Redis-only, missing fallback sync
- ❌ **MCP Integration** (03) dropped by design (context window overhead)

**Critical Gap:** Agent tool interception (destructive commands, secret redaction) not yet enforced.

---

## Module-by-Module Status

### 1. ✅ Parallel Scheduler (02) — COMPLETE

**Files:**
- `src/application/services/scheduler/index.ts` — Main scheduler orchestration
- `src/application/workers/workerPool.ts` — 3-worker pool management
- `src/infrastructure/network/resilience/fileLockManager.ts` — Locking mechanism
- `src/infrastructure/adapters/os/worktreeManager.ts` — Worktree isolation

**What Works:**
- Dual-queue system (ready/waiting) implemented via `DualQueueAdapter`
- Worker pool pre-spawns 3 workers, monitors heartbeat
- File locking with exponential backoff prevents race conditions
- Git worktree isolation per worker prevents file conflicts
- Task recovery on scheduler crash (re-enqueues interrupted tasks)

**Evidence of Completeness:**
```typescript
// From scheduler/index.ts
await workerPool.init(); // Pre-spawn workers
const state = await persistence.readState();
// Dispatch ready tasks to workers
for (const task of readyTasks) {
  await workerPool.dispatch(task); // Non-blocking
}
```

**What's Missing:** None — module is production-ready.

---

### 2. ✅ Model Routing (05) — COMPLETE

**Files:**
- `src/config/agents/providers/strategies.ts` — Routing logic
- `src/domain/agents/promptBuilder.ts` — Tool selection per task

**What Works:**
- Tasks explicitly specify `tool: "gemini" | "cursor" | "copilot" | "claude"`
- No "agent personalities"—just routing tables
- Strategy chains allow task → best-fit model selection

**What's Missing:** None — working as designed.

---

### 3. ⚠️ Safety Layer (01) — PARTIAL (~20%)

**Files:**
- `src/infrastructure/connectors/os/executors/commandExecutor.ts` — Read-only whitelist
- `src/infrastructure/connectors/os/executors/fileSystem.ts` — File ops

**What Exists:**
```typescript
// From commandExecutor.ts
const ALLOWED_COMMANDS = ['ls', 'find', 'grep', 'cat', 'head', 'tail', ...];
const BLOCKED_PATTERNS = [/rm\s+/, /mv\s+/, /chmod\s+/, ...];

function isCommandAllowed(command: string): { allowed: boolean; reason?: string }
```

**Critical Gaps:**
1. **No middleware pipeline** — The planned `ToolMiddleware` interface doesn't exist
2. **Only validates deterministic checks** — Not agent-generated tool calls
3. **No secret redaction** — Secrets can leak in agent output
4. **No UI safety modal** — Operator can't approve risky commands
5. **Missing implementations:**
   - `src/domain/tooling/middleware.ts` (interface)
   - `ShellSafetyMiddleware` (block `rm -rf`, `dd`, `git push --force`)
   - `SecretGuardMiddleware` (detect/redact secrets)
   - `PathConfinementMiddleware` (enforce sandbox)
   - Safety event emitter for UI modal

**Plan Reference:** See `docs/plans/v2-architecture/01_SAFETY_LAYER.md` sections 2-4 for architecture.

---

### 4. ⚠️ Hybrid Memory (04) — PARTIAL (~30%)

**Files:**
- `src/application/services/persistence.ts` — State management
- `src/application/services/persistence.js` — Legacy adapter

**What Exists:**
- DragonflyDB (Redis-compatible) for primary state
- State persisted after every control loop iteration
- Session reuse tracking in state

**Critical Gaps:**
1. **No fallback persistence** — If Redis crashes, state is lost
2. **No automatic JSON sync** — Users can't easily inspect/restore state
3. **Missing implementations:**
   - Background task: write `state.json` after every state update
   - On startup: if Redis unavailable, load from `state.json`
   - SQLite schema (future) for historical state tracking

**Plan Reference:** See `docs/plans/v2-architecture/04_HYBRID_MEMORY.md` sections 2-3.

---

### 5. ❌ MCP Integration (03) — DROPPED

**Decision:** Dropped by design (memory note: 2026-03-12).

**Reason:** MCP tools consume significant context window. Custom tool wrappers (`fileSystem.ts`, `commandExecutor.ts`) are sufficient and context-efficient.

**Plan Reference:** See `docs/plans/v2-architecture/03_MCP_STRATEGY.md` (archived for reference only).

---

## Implementation Roadmap

### Phase 1: Safety Layer Middleware (1-2 Sprints)

**Priority:** CRITICAL — Required before agent autonomy in production.

**Tasks:**
1. Define `ToolMiddleware` interface (`src/domain/tooling/middleware.ts`)
   - Methods: `name`, `priority`, `intercept(call: ToolCall)`
   - Return: `ToolCallResult | 'CONTINUE'`

2. Implement core middleware:
   - `ShellSafetyMiddleware` — Block CRITICAL (`dd`, `mkfs`), MODERATE (`rm` → `rm -i`)
   - `SecretGuardMiddleware` — Load ENV secrets, redact from input/output
   - `PathConfinementMiddleware` — Enforce `SANDBOX_ROOT`, block `..` traversal

3. Hook into dispatch:
   - Modify `src/domain/agents/promptBuilder.ts` to route tool calls through middleware chain
   - Add `SafetyChallenge` event emitter for HIGH-risk commands

4. UI Modal (dependent on above):
   - Dashboard receives `SafetyChallenge` event
   - Modal: "Agent wants to run `rm -rf src`. Allow? [Yes/No]"
   - Response: Resume/cancel task

**Acceptance Criteria:**
- ✅ Agent cannot execute `rm -rf`, `dd`, `git push --force` without operator approval
- ✅ Secrets in ENV redacted from logs
- ✅ Operator can approve/deny risky commands via UI
- ✅ E2E safety test covering agent → middleware → execution

---

### Phase 2: Hybrid Memory Fallback (1 Sprint)

**Priority:** HIGH — Improves crash resilience and debuggability.

**Tasks:**
1. Add background sync:
   - After every `persistence.writeState()`, also write to `sandbox/<project>/state.json`
   - Non-blocking (fire-and-forget)

2. On startup:
   - Try to connect to DragonflyDB
   - If unavailable, load from `state.json` and warn operator

3. Add `state.json` to `.gitignore` (binary state, not code)

**Acceptance Criteria:**
- ✅ State survives Redis crash (recovered from `state.json`)
- ✅ `state.json` human-readable for debugging
- ✅ No performance penalty (async write)

---

### Phase 3: Safety Validation Testing (1 Sprint)

**Priority:** HIGH — Prevents regression.

**Tasks:**
1. Add E2E test suite (`tests/e2e/safety-layer.test.ts`):
   - Test destructive command blocking
   - Test secret redaction
   - Test operator approval flow
   - Test sandbox confinement

**Acceptance Criteria:**
- ✅ All risky patterns blocked
- ✅ Secrets redacted
- ✅ Operator can approve/deny via API (test harness)

---

## Code Locations Reference

**Scheduler (Complete):**
- `src/application/services/scheduler/index.ts`
- `src/application/workers/workerPool.ts`
- `src/domain/executors/taskQueue.ts` (DualQueueAdapter)

**Existing Safety (Partial):**
- `src/infrastructure/connectors/os/executors/commandExecutor.ts` (read-only whitelist)

**Persistence (Partial):**
- `src/application/services/persistence.ts` (DragonflyDB primary)
- Missing: Background sync to `state.json`

**To Implement:**
- `src/domain/tooling/middleware.ts` (interface + base class)
- `src/domain/tooling/shellSafetyMiddleware.ts` (destructive command blocking)
- `src/domain/tooling/secretGuardMiddleware.ts` (secret redaction)
- `src/infrastructure/connectors/os/sallyConfinementMiddleware.ts` (sandbox enforcement)
- UI modal handler in `UI/src/components/SafetyChallenge.tsx`

---

## Testing Strategy

**Current Coverage:**
- Parallel scheduler has unit tests in `tests/`
- Deterministic validation has tests

**Missing:**
- E2E safety middleware tests
- Hybrid memory fallback tests
- Operator approval flow tests (UI + API)

**Recommendation:** Add `tests/e2e/safety-layer.test.ts` before Phase 1 completion.

---

## Notes for Future Sprints

1. **Don't re-implement MCP** — The decision to drop MCP is sound. Revisit only if context window expands significantly.
2. **Safety Layer is blocking** — Cannot claim "production-ready" until Phase 1 complete.
3. **Hybrid Memory improves DX** — Lower priority but high ROI for debugging and resilience.
4. **UI Modal is UX-critical** — Without operator approval flow, safety is "fail-closed" (blocks agent). With modal, it's "fail-safe + operator-controlled".

---

**Next Action:** Prioritize Safety Layer Phase 1. Recommend starting with `ToolMiddleware` interface and `ShellSafetyMiddleware` implementation.
