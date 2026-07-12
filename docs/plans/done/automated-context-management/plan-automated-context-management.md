# Plan: Unified Context & Knowledge System

**Status**: Meta-plan with phased implementation  
**Implementation Guide**: [plan-revised-minified-step1.md](plan-revised-minified-step1.md) (Phase 1 - Ready to implement)  
**Review & Rationale**: [review.md](review.md) (Critique of original issues & fixes)

---

## Document Structure

This document provides the **vision and strategic design** for a multi-tiered context system. 

**For implementation details, risks addressed, and concrete code paths**, see:
- **Phase 1 (NOW)**: [plan-revised-minified-step1.md](plan-revised-minified-step1.md) - 1-2 day implementation, ready to ship
- **Phase 2 (FUTURE)**: Research-only until Phase 1 validated

---

## Problem Statement

The Supervisor currently relies on two extremes for context:
1.  **Static Documentation:** `contexts/` files that are manually maintained and often stale.
2.  **Minimal Runtime Context:** A very narrow window (often just the last task) provided in the prompt.

This leads to "amnesia" where the agent:
*   Repeats mistakes from 10 tasks ago.
*   Loses the "thread" of a multi-step implementation.
*   Cannot find relevant code in large projects without "context stuffing" (providing too much irrelevant text).

## Objective

Implement a **multi-tiered context system** that gives the agent both **"Working Memory"** (recent actions) and **"Associative Memory"** (relevant code/history) using existing infrastructure.

### Phase Breakdown

**Phase 1: Working Memory** ✅ READY FOR IMPLEMENTATION
- Solve immediate amnesia (agent sees last 5 tasks instead of 1)
- Low risk, no new infrastructure
- 1-2 day delivery
- See [plan-revised-minified-step1.md](plan-revised-minified-step1.md)

**Phase 2: Associative Memory** 🔄 DEFERRED (Research only)
- Semantic code retrieval via RAG (future enhancement)
- Only if Phase 1 proves insufficient after validation
- Requires operator approval + infrastructure decisions
- See section below for design vision

---

## Phase 1: Enhanced Runtime Context (Working Memory)

### Goal
Fix the immediate "amnesia" about recent actions by enriching runtime context with semantic task information.

### Status
✅ **ACTIVE** - Ready for implementation  
👉 **See [plan-revised-minified-step1.md](plan-revised-minified-step1.md) for detailed implementation guide with:**
- Concrete file paths (4 files to modify)
- Step-by-step implementation (7 steps, ~10 hours)
- Code examples with line numbers
- Testing strategy
- Performance targets
- Backward compatibility validation

### Summary of Phase 1

#### 1.1 Schema Enhancement with Feature Toggle
The `CompletedTask` interface will add a `requires_context` toggle to enable gradual rollout:
*   **Action:** Update `src/domain/types/types.ts` to add `requires_context` field and optional context fields
*   **Backward Compatible:** Toggle defaults to false; old behavior preserved until explicitly enabled
*   **Gradual Rollout:** Start with toggle off, enable selectively per task type for validation
*   **Backfill Strategy:** Existing state loads without crashes; backfill sets `requires_context: false`

**New Structure**:
```typescript
export interface CompletedTask {
  task_id: string;
  completed_at: string;
  requires_context: boolean;  // Feature toggle (default: false = old approach)
  intent?: string;            // Task intent (only populated if requires_context=true)
  summary?: string;           // Deterministic summary (only populated if requires_context=true)
  validation_report: ValidationReport;
}
```

**Toggle Behavior**:
- `requires_context: false` → Task is treated as opaque (existing behavior)
- `requires_context: true` → Task intent + summary are captured and injected into subsequent prompts

#### 1.2 Context Injection ("Sliding Window")
*   **Action:** Modify `PromptBuilder.buildMinimalState()` in `src/domain/agents/promptBuilder.ts`
*   **Behavior:**
    *   **Always** inject the last **5 completed tasks** (ID + Intent + Success status)
    *   **Always** inject **active blockers** (ID + Reason + Blocked timestamp)
    *   Remove restrictive keywords (e.g., no longer requires "extend" to see history)
*   **Outcome:** The agent always knows "where it came from" and "what is blocked"

**Agent now receives**:
```markdown
## Recent Task History
1. task-042: "Implement user authentication module" (completed: 2026-01-11T10:00Z, ✓ success)
2. task-043: "Add JWT validation middleware" (completed: 2026-01-11T10:05Z, ✓ success)
3. task-044: "Create login endpoint" (completed: 2026-01-11T10:10Z, ✓ success)
...etc, up to 5 tasks...

## Active Blockers
- task-N: "Reason why this task is blocked" (blocked: 2026-01-11T09:00Z)
```

#### 1.3 State Management
*   **Action:** Update `TaskFinalizer` to capture and manage context
    - Capture `task.intent` on completion
    - Generate deterministic summaries (no LLM, pure logic)
    - Prune `completed_tasks` to keep state bounded (max 100 tasks)
*   **Benefit:** State size stays ~500KB max, no unbounded growth
*   **Full History:** Audit log still retains everything (single source of truth)

### Phase 1 Benefits
- ✅ **Solves Real Problem:** Agent goes from 1-task context to 5-task context
- ✅ **Low Risk:** Backward compatible, optional fields only
- ✅ **No Infrastructure:** Uses existing state mechanism
- ✅ **Performance:** <5ms overhead per operation
- ✅ **Cost:** $0 extra
- ✅ **Testable:** Clear unit/integration test paths
- ✅ **Fast Delivery:** 1-2 days to implement

### Phase 1 Implementation Path
**→ [plan-revised-minified-step1.md](plan-revised-minified-step1.md)**

---

## Phase 2: Native RAG Integration (Associative Memory)

### Goal
Allow the agent to "recall" relevant code and past solutions without context stuffing or hallucination risk.

### Status
🔄 **DEFERRED** - Research phase only

**Prerequisites before Phase 2 approval:**
1. ✅ Phase 1 deployed and running for 2+ weeks
2. ✅ Operator confirms Phase 1 did NOT solve amnesia problem
3. ✅ Metrics show agent still repeating mistakes or losing context
4. ✅ Operator explicitly approves RAG investment + infrastructure decisions

### Phase 2 Vision (Strategic Design)

**Philosophy:** Radical Simplicity. Use **DragonflyDB** (already running) + **Local Embeddings** (no API costs).

**Operational rules:**
- Indexing/refresh runs async via a background worker or separate Redis list; never block the control loop. If the index is stale/unavailable, skip RAG gracefully.
- Retrieval stays sync at prompt-build with validation gates and a stale-timeout fallback (no blocking retries inside the loop).
- Default to include recent history even for loosely related tasks; allow opt-out per task (`requires_context=false`) for truly isolated work, and consider per-project/task_type windows if noise appears.

### Async RAG Operations (Detailed)

- **Separation:** Control loop enqueues “index-refresh” messages; a background worker performs indexing. Loop never waits on RAG.
- **Queue/Broker:** Start with Redis list/stream in a dedicated DB (e.g., DB 3) containing `{project_id, sandbox_root, changed_files?, requested_at}`. Worker pops with backoff; coalesce per project to avoid stampede. If backlog grows, drop oldest/coalesce.
- **Indexing Guardrails:** Limit max files and file size; skip vendored/build dirs and binaries; per-run timeout. On failure/timeout, log and requeue with jittered backoff. Track `indexed_at` per project; mark index stale when over threshold.
- **Retrieval Path (sync at prompt-build):** If index missing/stale/unreachable, skip RAG entirely (no inline retries). Apply gates: file exists, within sandbox, non-binary, score ≥ threshold, cap injected context (e.g., 2KB) and top results (e.g., 3).
- **Toggle Behavior:** Per-task `requires_context` (default false) controls use of history/RAG; optional per-project or per-task_type policies to reduce noise on unrelated tasks.
- **Monitoring/Backpressure:** Track queue depth, avg index duration, stale ratio, retrieval hit-rate, fallback rate. If depth exceeds threshold, temporarily mark index stale/skip RAG until caught up.
- **Failure Modes:** Worker failure → alert + continue without RAG; Redis outage → skip RAG and retry later; oversize index → prune by LRU per project/file.

#### 2.1 Infrastructure: DragonflyDB Vector Store (Proposed, Not Final)

**Considerations:**
- Use dedicated Redis logical database (e.g., `DB 3`) for vector index
- Isolate from State (DB 0) and Queue (DB 2)
- Requires RediSearch module in DragonflyDB (operator decision)
- Alternative: Simple filename index (lighter weight, no embeddings)

**If RediSearch Path:**
*   **Technology:** DragonflyDB native RediSearch compatibility (requires module)
*   **Index Type:** HNSW vector index on embedding field
*   **Key Pattern:** `chunk:{file_hash}`

#### 2.2 Indexing Strategy (Proposed)

**NOT On Every Task** (would block finalization):
*   **Async Background Worker:** Index in non-blocking background thread
*   **Incremental Only:** Only re-index changed files, not full codebase
*   **Bounded:** Skip binaries, large files (>500KB), vendored dirs (node_modules, .git)
*   **Fallback:** Graceful degradation if indexing fails (doesn't break tasks)

**Indexing Process:**
1. Scan text files in `sandbox/` (ignore `.git`, `node_modules`, `dist`, etc.)
2. Chunk files into semantic segments (~500 tokens each)
3. Generate embeddings locally using `transformers.js` (Model: `Xenova/all-MiniLM-L6-v2`)
4. Upsert to DragonflyDB (replace existing chunks for file)

#### 2.3 Semantic Context Injection (Proposed)

**Validation Gates** (prevent hallucination):
- File exists check (filter stale chunks)
- Sandbox path validation (prevent traversal)
- Binary detection (skip corrupted output)
- Relevance threshold (only inject high-confidence matches)

**Retrieval Process:**
1. Generate embedding for current `Task.intent`
2. Query DragonflyDB for top 5 nearest chunks (cosine similarity)
3. Validate each chunk against gates
4. Inject into prompt with scores and file paths

**Output Example**:
```markdown
## RELEVANT CODEBASE CONTEXT (from RAG)
Found 3 relevant snippets:

1. src/auth/login.ts (Relevance: 0.89)
   [code snippet, max 200 chars]

2. src/auth/middleware.ts (Relevance: 0.85)
   [code snippet, max 200 chars]

3. src/auth/jwt-handler.ts (Relevance: 0.78)
   [code snippet, max 200 chars]
```

### Phase 2 Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| RediSearch module not available | High | Medium | Operator must enable module or use alternative index |
| Background indexing blocks control loop | High | Low | Use worker thread, timeout, graceful fail |
| Stale chunks in index | Medium | Medium | File-exists check + periodically prune |
| Hallucination from poor matches | High | High | Relevance threshold + validation gates |
| Performance degradation | Medium | Medium | Benchmark; disable if >500ms overhead |
| State/index sync issues | Medium | Low | Immutable index (only append), full re-index on startup |

### Phase 2 Decision Tree

```
Phase 1 deployed for 2 weeks
     ↓
Does agent still repeat mistakes? → YES → Evaluate Phase 2
     ↓ NO
Done. Phase 1 sufficient.

Evaluate Phase 2:
  - Operator approval needed? → NO approval → Stay with Phase 1
  - RediSearch available? → NO → Use lightweight filename index instead
  - Yes to both? → Design Phase 2 carefully with validation + async

Implement Phase 2:
  - Start with lightweight index (faster path)
  - Graduate to RAG only if metrics prove value
```

### Phase 2 Alternative: Lightweight Index (Lower Risk)

If RAG complexity is too high, use simple approach:
```typescript
// Instead of embeddings:
// Store filename + first 100 chars of content in Redis hash
// Search by filename pattern matching (no ML needed)
// Much faster setup, sufficient for "find related file"
```

Benefits:
- ✅ Zero ML dependencies
- ✅ Sub-millisecond search
- ✅ Deterministic (same query = same results)
- ✅ Easy to validate
- ✅ Can toggle off with flag

---

## Implementation Order

### Phase 1 (ACTIVE NOW)
1. ✅ Enhance `CompletedTask` schema
2. ✅ Add backfill logic to state loader
3. ✅ Update `TaskFinalizer` with capture + pruning
4. ✅ Modify `PromptBuilder` for always-on injection
5. ✅ Comprehensive testing
6. ✅ Performance validation
7. ✅ Deploy to production

**Timeline**: 1-2 days  
**Risk**: Low  
**Approval**: Operator approval of this document

### Phase 2 (DEFERRED)
1. ⏸️ Run Phase 1 for 2+ weeks in production
2. ⏸️ Collect metrics on agent amnesia reduction
3. ⏸️ If sufficient: Done (Phase 1 is the solution)
4. ⏸️ If insufficient: Revisit Phase 2 design with operator
5. ⏸️ Design decision: Full RAG vs lightweight index vs alternative

**Timeline**: 3-5 days (if approved)  
**Risk**: Medium  
**Approval**: Operator must explicitly approve after Phase 1 validation

---

## Benefits

### Phase 1
*   **Architecture Aligned:** Uses existing state/persistence (no new containers)
*   **Cost:** $0 extra
*   **Performance:** <5ms overhead
*   **Reliability:** Single source of truth (state) + audit log
*   **Backward Compatible:** Old deployments work without migration

### Phase 2 (if implemented)
*   **Architecture Aligned:** No new containers, local processing
*   **Cost:** $0 extra (local embeddings)
*   **Performance:** 50-200ms retrieval (acceptable for prompt building)
*   **Scalability:** Incremental indexing (not full re-scan)
*   **Safety:** Validation gates prevent hallucination

---

## Success Metrics

### Phase 1
- ✅ Agent sees last 5 tasks in every prompt
- ✅ Agent can reference task intents by name
- ✅ No performance regression (< 5ms overhead)
- ✅ Backward compatible load test passes
- ✅ State size stays bounded (< 100 tasks)
- ✅ Reduced "repetition of mistakes" (qualitative assessment)

### Phase 2 (if approved)
- ✅ Agent correctly identifies relevant code (relevance > 0.75)
- ✅ No hallucinations (validation gates working)
- ✅ Indexing overhead < 100ms per task (async)
- ✅ Measurable improvement over Phase 1 (quantitative metrics)

---

## Related Plans

- [Task Dependencies & Parallel Execution](../task-dependencies-parallel-execution.md) - Orthogonal (scheduling vs context)
- [Context Window Exhaustion Handoff](../context-window-exhaustion-handoff.md) - Related (large context handling)

---

## References

**Implementation Details:**
- [plan-revised-minified-step1.md](plan-revised-minified-step1.md) - Concrete Phase 1 implementation guide
- [review.md](review.md) - Detailed critique of original issues and design fixes

**Code Locations:**
- Types: `src/domain/types/types.ts` (line 117)
- Persistence: `src/application/services/persistence.ts`
- TaskFinalizer: `src/application/services/controlLoop/modules/taskFinalizer.ts`
- PromptBuilder: `src/domain/agents/promptBuilder.ts`
- Audit Log: `sandbox/<project>/logs/audit.log.jsonl`
