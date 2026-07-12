# Review: Automated Context Management Plan

**Reviewed**: 2026-01-11  
**Status**: ⚠️ **NOT RECOMMENDED FOR IMPLEMENTATION AS-IS**

---

## Executive Summary

The plan proposes automating supervisor context updates via a new `ContextManager` service that updates markdown files after task completion. However, this approach:

1. **Conflicts** with existing `windows/` structure already documented
2. **Violates** architectural principles (operator control, no autonomous decisions)
3. **Duplicates** existing functionality (state, audit log)
4. **Introduces** unnecessary complexity to critical path

**Recommendation**: Use existing state + audit log mechanisms. If automation needed, implement minimal JSON-based approach instead of markdown manipulation.

---

## Critical Issues

### 1. Conflicting Context Structure

**Problem**: Plan proposes `active/` and `archive/` directories that conflict with existing, documented `windows/` structure.

**Existing** (per `supervisor-contexts/README.md`):
```
supervisor-contexts/
├── CONTEXT.md          # Main comprehensive context
├── windows/            # Sliding window of 10 latest context files
│   └── README.md
└── README.md
```

**Proposed**:
```
supervisor-contexts/
├── CONTEXT.md
├── active/             # NEW - conflicts with windows/
│   ├── current_status.md
│   └── decisions.log.md
└── archive/            # NEW - duplicates functionality
    ├── history.md
    └── epics/
```

**Impact**: Creates parallel, competing structures. Confusion about which is source of truth.

---

### 2. Non-Existent Service Directory

**Problem**: Plan references `src/domain/services/contextManager.ts` but `src/domain/services/` does not exist.

**Current Architecture**:
- `src/application/services/` - Application layer services
- `src/domain/ports/` - Domain interfaces/ports
- `src/infrastructure/adapters/` - Infrastructure implementations

**Issue**: Plan doesn't align with hexagonal architecture pattern used throughout codebase.

---

### 3. Scope Creep: Mixing Concerns

**Problem**: Plan conflates two distinct responsibilities:

1. **Task History Tracking** (runtime data) → Belongs in State/Audit Log
2. **Agent Context Documentation** (architectural knowledge) → Belongs in static docs

**Current Solutions Already Exist**:

| Need | Current Solution | Location |
|------|-----------------|----------|
| Task history | `state.completed_tasks[]` | Redis (DB 0) |
| Task details | `audit.log.jsonl` | Filesystem (append-only) |
| Last 5 tasks | Query audit log | `sandbox/<project>/logs/audit.log.jsonl` |
| Architectural decisions | Manual documentation | `supervisor-contexts/windows/` |

**Example**: Current state already tracks:
```typescript
state.completed_tasks = [
  {
    task_id: "task-001",
    completed_at: "2026-01-11T10:30:00Z",
    validation_report: { ... }
  }
]
```

---

### 4. Violates Core Principles

**Problem**: Automated context updates create feedback loop where supervisor modifies its own context.

**Violations**:

1. **"No Autonomous Decisions"**: Supervisor would autonomously decide what constitutes a "significant architectural decision"
2. **"Operator Control"**: Documentation becomes AI-managed instead of operator-controlled
3. **"No Helpful Corrections"**: Automatically "improving" documentation is a correction
4. **"Deterministic Execution"**: Markdown parsing/generation introduces non-determinism

**From `supervisor-contexts/CONTEXT.md`**:
> The supervisor does **not** define goals. Operator must inject goals.
> No refactoring without explicit instruction.
> Anti-Goals: Autonomous goal refinement, "Helpful" corrections

**Risk**: Agent could hallucinate "decisions" based on task patterns, creating false architectural narrative.

---

### 5. Performance & Complexity Impact

**Problem**: Adds file I/O to critical path (TaskFinalizer).

**Current TaskFinalizer Flow** (6 steps):
```typescript
1. Update State Metadata
2. Mark Task Completed
3. Cleanup Retry State
4. Analytics
5. Persist State (Redis)
6. Append Audit Log (File I/O)
```

**Proposed Addition**:
```typescript
7. Update active/current_status.md (Read + Parse + Write)
8. Update active/decisions.log.md (Read + Parse + Write)
9. Check if pruning needed
10. If yes: Read archive/history.md, append, write, then update current_status.md again
```

**Risks**:
- **File corruption**: Concurrent writes if supervisor crashes mid-update
- **Race conditions**: Multiple supervisors (future?) writing same files
- **Parse errors**: Malformed markdown breaks finalization
- **Performance**: 2-4 file operations per task (currently 1)

---

## Detailed Analysis

### The "Staleness Problem" Doesn't Exist

**Plan Claims**:
> The `supervisor-contexts` documentation is static and prone to staleness.

**Reality**: This is **by design** and already solved:

1. **Runtime Context**: Injected via `PromptBuilder.buildMinimalState()`:
   ```typescript
   {
     project: { id, sandbox_root },
     goal: { description, completed },
     completed_tasks: [...],  // Already includes recent tasks
     blocked_tasks: [...]
   }
   ```

2. **Task History**: Available in `audit.log.jsonl`:
   ```jsonl
   {"event":"TASK_COMPLETED","task_id":"task-001","timestamp":"..."}
   {"event":"TASK_COMPLETED","task_id":"task-002","timestamp":"..."}
   ```

3. **Architectural Docs**: Should be **stable** (not changing with every task):
   - Hexagonal architecture doesn't change daily
   - Core principles remain constant
   - Only major refactors warrant documentation updates

**Agents Already Have Memory**: They receive:
- Current goal state
- Recent completed task IDs
- Blocked tasks with reasons
- Last validation report
- Project sandbox path

---

### Markdown Manipulation is Fragile

**Plan Proposes**:
> Implement markdown parsing/updating logic (simple string manipulation or AST if needed, likely regex/string split is sufficient).

**Problems**:

1. **Parsing Complexity**: Markdown isn't a formal grammar:
   ```markdown
   ## Recent Tasks
   - Task 001: Description with `code` and [links](url)
   - Task 002: Description with **bold** and *italic*
   ```
   Need to handle: code blocks, links, formatting, escaping, etc.

2. **Update Ambiguity**: How to update "Last 5 Tasks" section?
   - What if format changes?
   - What if operator manually edited?
   - What if heading renamed?

3. **No Validation**: Unlike JSON schema validation for state, markdown has no contract:
   - Typo in heading → parsing fails
   - Wrong indentation → list breaks
   - Operator edit → automation conflicts

4. **Maintenance Burden**: Every markdown structure change requires code update.

---

## Alternative Solutions

### Option A: Status Quo (Recommended)

**Keep current approach**:
- ✅ State in Redis handles runtime context
- ✅ Audit log handles complete task history
- ✅ `supervisor-contexts/` remains static, operator-maintained
- ✅ `PromptBuilder` injects minimal state (already implemented)

**Enhancement** (if needed):
```typescript
// In promptBuilder.ts - buildMinimalState()
context.recent_tasks = state.completed_tasks
  .slice(-3)  // Last 3 tasks
  .map(t => ({ task_id: t.task_id, completed_at: t.completed_at }));
```

**Benefits**:
- Zero complexity added
- Leverages existing, proven mechanisms
- Maintains operator control
- No performance impact

---

### Option B: Minimal JSON Context (If Automation Required)

**Create single automated file**: `supervisor-contexts/session-state.json`

**Structure**:
```json
{
  "last_updated": "2026-01-11T10:30:00Z",
  "recent_tasks": [
    {
      "task_id": "task-003",
      "completed_at": "2026-01-11T10:25:00Z",
      "intent": "Implement validation",
      "success": true
    },
    {
      "task_id": "task-004",
      "completed_at": "2026-01-11T10:28:00Z",
      "intent": "Add tests",
      "success": true
    },
    {
      "task_id": "task-005",
      "completed_at": "2026-01-11T10:30:00Z",
      "intent": "Fix linting",
      "success": true
    }
  ],
  "active_blocker": null,
  "goal_progress": {
    "total_tasks_completed": 5,
    "total_tasks_blocked": 0,
    "goal_completed": false
  }
}
```

**Implementation**:
```typescript
// src/application/services/contextWriter.ts
export class ContextWriter {
  async updateSessionState(state: SupervisorState): Promise<void> {
    const sessionState = {
      last_updated: new Date().toISOString(),
      recent_tasks: state.completed_tasks.slice(-5).map(t => ({
        task_id: t.task_id,
        completed_at: t.completed_at,
        intent: t.intent || 'Unknown',
        success: true
      })),
      active_blocker: state.blocked_tasks?.[0] || null,
      goal_progress: {
        total_tasks_completed: state.completed_tasks.length,
        total_tasks_blocked: state.blocked_tasks?.length || 0,
        goal_completed: state.goal.completed
      }
    };
    
    const filePath = path.join(
      __dirname, 
      '../../../supervisor-contexts/session-state.json'
    );
    await fs.promises.writeFile(filePath, JSON.stringify(sessionState, null, 2));
  }
}
```

**Usage in TaskFinalizer**:
```typescript
// After persisting state
await this.contextWriter.updateSessionState(state);
```

**Consumption in PromptBuilder**:
```typescript
// Read session-state.json alongside CONTEXT.md
const sessionState = JSON.parse(
  fs.readFileSync('supervisor-contexts/session-state.json', 'utf-8')
);
// Include in system prompt
```

**Benefits**:
- Structured data (JSON) with validation
- Single file (no directory structure changes)
- Application layer (not domain)
- No markdown parsing complexity
- Atomic writes (single file.writeFile)

**Tradeoffs**:
- Still adds file I/O to critical path
- Still creates automated feedback loop
- Duplicates information already in state/audit log

---

### Option C: Enhance Prompt Builder (Lightest)

**No new files, no new services**. Simply enhance what already exists:

```typescript
// In promptBuilder.ts - buildSystemPrompt()
export function buildSystemPrompt(
  task: Task,
  state: SupervisorState,
  sandboxRoot: string
): string {
  let prompt = fs.readFileSync('supervisor-contexts/CONTEXT.md', 'utf-8');
  
  // Add recent task summary
  if (state.completed_tasks?.length > 0) {
    const recentTasks = state.completed_tasks.slice(-3);
    prompt += `\n\n## Recent Completed Tasks (Last 3)\n`;
    recentTasks.forEach(t => {
      prompt += `- ${t.task_id} (completed: ${t.completed_at})\n`;
    });
  }
  
  // Add active blockers
  if (state.blocked_tasks?.length > 0) {
    prompt += `\n\n## Active Blockers\n`;
    state.blocked_tasks.forEach(t => {
      prompt += `- ${t.task_id}: ${t.reason}\n`;
    });
  }
  
  return prompt;
}
```

**Benefits**:
- Zero new infrastructure
- Zero new files/directories
- Zero performance impact (data already in memory)
- Uses existing state (no duplication)
- Maintains operator control (docs remain static)

**This is the recommended approach if agents need more task context.**

---

## Architectural Concerns

### Where Does Context Writing Belong?

If automated context is implemented, it must follow hexagonal architecture:

```
❌ WRONG: src/domain/services/contextManager.ts
   - Domain should be infrastructure-agnostic
   - File I/O is infrastructure concern
   
✅ CORRECT: src/application/services/contextWriter.ts
   - Application layer coordinates domain + infrastructure
   - Can depend on filesystem
   
✅ CORRECT: src/infrastructure/adapters/contextPersistence.ts
   - Infrastructure layer handles technical details
   - Implement via port defined in domain
```

**Proper Port/Adapter Pattern**:
```typescript
// src/domain/ports/contextPersistence.ts
export interface ContextPersistencePort {
  updateSessionState(state: SupervisorState): Promise<void>;
}

// src/infrastructure/adapters/contextPersistence.ts
export class FileSystemContextAdapter implements ContextPersistencePort {
  async updateSessionState(state: SupervisorState): Promise<void> {
    // Write to filesystem
  }
}

// src/application/services/controlLoop/modules/taskFinalizer.ts
constructor(
  private contextPersistence: ContextPersistencePort  // Inject port
) {}
```

---

## Integration Concerns

### PromptBuilder Changes Required

**Current** (`promptBuilder.ts:762 lines`):
```typescript
export function buildSystemPrompt(task: Task, state: SupervisorState): string {
  let systemPrompt = '';
  
  // Read CONTEXT.md
  const contextPath = path.join(__dirname, '../../../supervisor-contexts/CONTEXT.md');
  if (fs.existsSync(contextPath)) {
    systemPrompt += fs.readFileSync(contextPath, 'utf-8') + '\n\n';
  }
  
  // Build task-specific prompt
  systemPrompt += buildTaskPrompt(task, state);
  
  return systemPrompt;
}
```

**Proposed Changes**:
```typescript
// Read CONTEXT.md
systemPrompt += fs.readFileSync('supervisor-contexts/CONTEXT.md', 'utf-8');

// Read active/current_status.md
systemPrompt += fs.readFileSync('supervisor-contexts/active/current_status.md', 'utf-8');

// Read active/decisions.log.md
systemPrompt += fs.readFileSync('supervisor-contexts/active/decisions.log.md', 'utf-8');
```

**Issues**:
- What if files don't exist? (initialization race condition)
- What if files are being written? (read during write)
- How to handle parsing errors? (malformed markdown)
- Prompt size increase (3 files vs 1)

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| File corruption during write | High | Medium | Use atomic writes (temp file + rename) |
| Markdown parsing errors halt finalization | High | Medium | Wrap in try/catch, log error, continue |
| Context files deleted by operator | Medium | Low | Check existence before read |
| Parallel write conflicts (future multi-process) | High | Low | File locking or queue writes |
| Prompt size explosion | Medium | High | Limit archive size, prune aggressively |
| Hallucinated "decisions" | High | High | Only record explicit decisions (where from?) |
| Performance degradation | Low | High | Benchmark: file I/O adds ~10-50ms per task |

---

## Recommendations

### Immediate Actions

1. **Do Not Implement Plan As-Is**: Conflicts and violations are blockers.

2. **Choose Alternative**:
   - **Best**: Option A (Status Quo) + enhance `PromptBuilder` to include last 3 task IDs
   - **If automation required**: Option B (single JSON file, application layer)
   - **Avoid**: Original plan (markdown manipulation, domain layer)

3. **Update Existing Docs**:
   - Clarify in `supervisor-contexts/README.md` that `windows/` is operator-maintained
   - Document that agents receive runtime context via `MinimalState` in prompts

4. **Test Current Context Injection**:
   - Verify agents actually need more context
   - Check if `state.completed_tasks[]` is sufficient
   - Review audit logs to see if task history is accessible

---

### If Proceeding with Automation

**Required Changes**:

1. **Architecture Alignment**:
   ```
   ❌ Remove: src/domain/services/contextManager.ts
   ✅ Add: src/infrastructure/adapters/contextPersistence.ts
   ✅ Add: src/domain/ports/contextPersistence.ts (interface)
   ```

2. **Structure Alignment**:
   ```
   ❌ Remove: active/ and archive/ directories
   ✅ Keep: windows/ (manual operator updates)
   ✅ Add: session-state.json (single automated file)
   ```

3. **Content Scope**:
   ```
   ✅ Include: Task IDs, completion timestamps, success status
   ❌ Exclude: "Architectural decisions" (subjective, hallucination risk)
   ❌ Exclude: Summaries (interpretation, not facts)
   ```

4. **Error Handling**:
   ```typescript
   try {
     await contextWriter.updateSessionState(state);
   } catch (error) {
     // Log but don't fail task finalization
     this.logger.error('ContextWriter', 'Failed to update session state', { error });
   }
   ```

5. **Testing Requirements**:
   - Unit tests for JSON serialization
   - Integration tests for file write failures
   - Performance benchmarks (baseline vs with context writes)
   - Crash recovery tests (mid-write supervisor restart)

---

## Comparison Matrix

| Aspect | Original Plan | Option A (Status Quo+) | Option B (JSON) | Option C (PromptBuilder) |
|--------|--------------|----------------------|-----------------|-------------------------|
| **Complexity** | High (markdown parsing) | Low (1 line change) | Medium (JSON writes) | Low (direct state read) |
| **Performance** | Poor (4+ file ops) | Excellent (0 file ops) | Fair (1 file op) | Excellent (in-memory) |
| **Maintainability** | Poor (brittle parsing) | Excellent (no new code) | Good (JSON schema) | Excellent (no new code) |
| **Operator Control** | ❌ Lost | ✅ Maintained | ⚠️ Partial | ✅ Maintained |
| **Architecture Fit** | ❌ Violates | ✅ Perfect | ⚠️ Acceptable | ✅ Perfect |
| **Risk** | High | None | Low | None |
| **Benefit** | Unclear | Sufficient | Marginal | Sufficient |

---

## Conclusion

**The problem the plan attempts to solve is already solved** by:
- `state.completed_tasks[]` (runtime task history)
- `audit.log.jsonl` (persistent task history with full details)
- `PromptBuilder.buildMinimalState()` (context injection to agents)

**If additional agent context is needed**:
1. First, enhance `PromptBuilder` to include last 3 task IDs from state (Option C)
2. Monitor if this is sufficient
3. Only if proven insufficient, consider Option B (single JSON file)
4. Never implement original plan (architectural violations)

**The `supervisor-contexts/windows/` directory exists for operator-maintained architectural updates**, not for automated task history. This separation is intentional and should be preserved.

---

## Questions for Operator

Before proceeding, clarify:

1. **What specific staleness problem are you observing?**
   - Are agents making mistakes due to lack of context?
   - What information do they need that they don't have?

2. **Have you checked the audit log?**
   - Does `audit.log.jsonl` contain the task history needed?
   - Is it accessible/readable for operator review?

3. **What is the goal of "decisions log"?**
   - Where do these "decisions" come from?
   - Who determines what is "significant"?
   - How to prevent hallucination?

4. **Why not use state.completed_tasks?**
   - This already tracks last N tasks
   - Already in memory (no I/O)
   - Already persisted (Redis)

5. **Is this solving a real problem or anticipated problem?**
   - Has a task failed due to lack of context?
   - Or is this preventative?

---

## References

- Current Architecture: `docs/ARCHITECTURE_DETAILED.md` (lines 1-300)
- Task Finalizer: `src/application/services/controlLoop/modules/taskFinalizer.ts`
- Prompt Builder: `src/domain/agents/promptBuilder.ts`
- Context Directory: `supervisor-contexts/README.md`
- Core Principles: `supervisor-contexts/CONTEXT.md` (lines 1-100)

---

**Review Status**: COMPLETE  
**Recommendation**: DO NOT IMPLEMENT - Use existing mechanisms or minimal alternatives
