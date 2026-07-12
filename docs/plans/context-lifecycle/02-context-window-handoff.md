# Context Window Exhaustion Handoff & Agent Context Dumping Plan

**Status**: Detailed Implementation Plan  
**Priority**: High (enables task continuation across context boundaries)  
**Date**: January 7, 2026  
**Estimated Timeline**: 3-4 weeks (4 phases)  
**Owner**: Supervisor Core Team

---

## Executive Summary

When agents approach context window limits, tasks risk failure due to insufficient space for new prompts. This plan introduces **proactive checkpoint creation at 90%, 95%, and 98% capacity**, with agents dumping context to sandbox markdown files, enabling seamless task continuation across agent/provider boundaries.

**Key Features:**
- Real-time token budget tracking per task
- Three-stage checkpoint system (90%, 95%, 98%)
- Agent-driven context dump to `contexts/sandbox/{project}/` markdown files
- Structured handoff protocol for next agent
- Fallback decision logic (fresh session, provider switch, helper verification)

**Expected Impact:**
- Prevent context window failures (zero task drops due to exhaustion)
- Enable multi-provider task continuation without repeating work
- Improve token efficiency (5-10% savings vs. re-explaining)
- Full audit trail of checkpoint decisions

---

## Problem Statement

### Scenario: Long-Running Tasks Exhaust Context

```
Task: "Build full e-commerce backend with auth, DB, API"
Provider: Gemini 2.0 Pro (2M token context)

Timeline:
- 0 iterations: Tokens used = 150K (7.5% of budget)
- 5 iterations: Tokens used = 800K (40% of budget)
- 10 iterations: Tokens used = 1.5M (75% of budget)
- 12 iterations: Tokens used = 1.8M (90% of budget) ← TRIGGER CHECKPOINT
- 13 iterations: Tokens used = 1.9M (95% of budget) ← SECONDARY CHECKPOINT
- 14 iterations: Tokens used = 1.98M (99% of budget) ← CRITICAL CHECKPOINT

Next prompt arrives: 50K tokens
Available space: 2K tokens
Result: API error "context_length_exceeded" → Task fails
```

### Current Issues

1. **No Proactive Detection**: Supervisor logs warning at 80% but takes no action
2. **Reactive Recovery**: Only after API error, reset session (loses all context)
3. **Work Loss**: Files created across 14 iterations must be rediscovered
4. **Token Waste**: New agent re-explains task instead of continuing from checkpoint
5. **No Continuity**: No bridge between "exhausted agent → next agent"

### Root Cause

- Token budgets defined but not enforced
- No automatic checkpoint mechanism
- No structured handoff protocol
- Agents unaware of capacity constraints

---

## Solution Design

### Architecture Overview

```
Task Execution Loop
├── Track tokens consumed (provider response metadata)
├── Calculate remaining tokens
├── Trigger checkpoints at thresholds:
│   ├── 90% capacity (180K tokens remaining / 200K buffer)
│   ├── 95% capacity (100K tokens remaining / critical)
│   └── 98% capacity (40K tokens remaining / imminent)
├── At each threshold:
│   ├── Supervisor detects threshold
│   ├── Agent dumps context to markdown files
│   ├── Supervisor creates checkpoint JSON
│   └── Decision: continue, fallback, or helper agent
└── On failure or completion:
    └── Resume from checkpoint if needed
```

### Three-Stage Checkpoint System

#### Stage 1: 90% Capacity (Warning + Dump)
- **Tokens Remaining**: ~200K (Gemini 2M limit)
- **Action**: 
  - Log: `[TOKEN ALERT] Task {task_id} at 90% capacity. Remaining: 200K tokens.`
  - Agent executes context dump command
  - Update `contexts/sandbox/{project}/project.md` with summary
  - Supervisor creates checkpoint
  - Decision: Continue current agent or prepare fallback
- **Prompt**: Agent receives instruction: "Context approaching limit. Dump execution summary to project.md now."
- **Output**: 
  - `contexts/sandbox/{project}/project.md` updated with progress
  - `contexts/sandbox/{project}/{specific_project}.md` updated with details
  - Checkpoint: `./tmp/context-checkpoints/{task_id}-{provider}-90p-{timestamp}.json`

#### Stage 2: 95% Capacity (Secondary Dump + Fallback Prep)
- **Tokens Remaining**: ~100K (increasingly critical)
- **Action**:
  - Log: `[CRITICAL] Task {task_id} at 95% capacity. Remaining: 100K tokens.`
  - Agent executes **full context dump** (more comprehensive)
  - Update `contexts/sandbox/{project}/project.md` with final state
  - Update `contexts/sandbox/{project}/{specific_project}.md` with complete checkpoint
  - Supervisor finalizes fallback provider selection
  - Decision: Initiate fallback handoff in next iteration
- **Prompt**: Agent receives instruction: "CRITICAL: Context limit imminent. Dump FULL execution state to {project}.md and {specific_project}.md now."
- **Output**:
  - `contexts/sandbox/{project}/project.md` final update
  - `contexts/sandbox/{project}/{specific_project}.md` with complete state
  - Checkpoint: `./tmp/context-checkpoints/{task_id}-{provider}-95p-{timestamp}.json`
  - Fallback provider staged

#### Stage 3: 98% Capacity (Emergency Dump + Force Handoff)
- **Tokens Remaining**: ~40K (emergency)
- **Action**:
  - Log: `[EMERGENCY] Task {task_id} at 98% capacity. Remaining: 40K tokens. FORCE HANDOFF.`
  - Agent executes **emergency context dump** (minimal, high-level only)
  - Final update to `contexts/sandbox/{project}/project.md`
  - Supervisor forces handoff to next agent immediately
  - No choice: must switch provider/role
- **Prompt**: Agent receives instruction: "EMERGENCY: Dump critical state only. Handoff IMMINENT."
- **Output**:
  - `contexts/sandbox/{project}/project.md` emergency update
  - Checkpoint: `./tmp/context-checkpoints/{task_id}-{provider}-98p-{timestamp}.json`
  - **Immediate handoff triggered** (no continuation)

### Data Structures

#### TaskTokenBudget
```typescript
interface TaskTokenBudget {
  task_id: string;
  provider: string;
  created_at: string;           // ISO timestamp
  
  // Limits & thresholds
  total_allocated: number;       // e.g., 1.8M for Gemini 2.0 (conservative 200K buffer)
  
  // Real-time tracking
  tokens_consumed: number;       // Updated after each agent execution
  tokens_remaining: number;      // total_allocated - consumed
  percent_used: number;          // (consumed / total_allocated) * 100
  
  // Thresholds
  warning_threshold: 0.80;       // 80% = log warning
  checkpoint_90_threshold: 0.90;  // 90% = dump context (project.md)
  checkpoint_95_threshold: 0.95;  // 95% = full dump (project.md + specific.md)
  checkpoint_98_threshold: 0.98;  // 98% = emergency dump + force handoff
  
  // Checkpoints created
  checkpoints: {
    checkpoint_90?: CheckpointMetadata;
    checkpoint_95?: CheckpointMetadata;
    checkpoint_98?: CheckpointMetadata;
  };
  
  // Decisions made
  decisions: {
    fallback_provider?: string;   // Selected for 95% + 98%
    fallback_triggered_at?: number; // Unix timestamp
    force_handoff_at?: string;    // ISO timestamp at 98%
  };
}
```

#### ContextCheckpoint
```typescript
interface ContextCheckpoint {
  checkpoint_id: string;
  created_at: string;           // ISO timestamp
  capacity_threshold: "90" | "95" | "98";
  reason: "window_warning" | "window_critical" | "window_emergency";
  
  task_id: string;
  provider_name: string;
  
  tokens: {
    consumed: number;
    remaining: number;
    total_allocated: number;
    percent_used: number;
  };
  
  conversation: {
    full_history: PromptLogEntry[];  // Complete conversation history
    summary: string;                  // Structured summary for next agent
    iteration_count: number;
  };
  
  execution_state: {
    iteration: number;
    files_created: string[];          // Relative paths in sandbox
    files_modified: string[];         // Relative paths in sandbox
    git_diff?: string;                // If git repo exists
    last_validation_result?: ValidationResult;
    current_error?: string;
    status: "in_progress" | "paused_for_handoff" | "completed";
  };
  
  context_dump_outputs: {
    project_md_updated: string;       // Path: contexts/sandbox/{project}/project.md
    specific_md_updated: string;      // Path: contexts/sandbox/{project}/{specific_project}.md
    dump_timestamp: string;
    dump_size_bytes: number;
  };
  
  next_action: {
    type: "continue" | "fallback" | "helper_agent" | "force_handoff";
    next_provider?: string;           // If fallback
    next_role?: string;               // If helper agent
    handoff_instruction?: string;
  };
}
```

#### ContextDumpPayload
```typescript
interface ContextDumpPayload {
  // File paths to update
  project_md: {
    path: string;                     // contexts/sandbox/{project}/project.md
    section: string;                  // "## Execution Checkpoint {iteration}"
    content: string;                  // Markdown formatted summary
  };
  
  specific_project_md: {
    path: string;                     // contexts/sandbox/{project}/{specific_project}.md
    section: string;                  // "## Checkpoint {capacity}% Complete"
    content: string;                  // Detailed state
  };
  
  checkpoint_metadata: {
    id: string;
    created_at: string;
    reason: string;
  };
}
```

### Agent Dump Commands

#### At 90% Capacity
```bash
# Supervisor sends instruction to agent:
cat > /tmp/context-dump-90.md << 'EOF'
## Context Dump: 90% Capacity

**Timestamp**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Task**: {task_id}
**Provider**: {provider}
**Tokens Remaining**: {remaining}K / {total}K

### What was accomplished:
{list of key files/changes in last 3 iterations}

### Current status:
{latest validation result, if any}

### Files created/modified:
{git diff summary}

### Next steps needed:
{high-level remaining work}
EOF

# Update project.md
cat >> contexts/sandbox/{project}/project.md << 'EOF'

## Checkpoint at 90% Capacity (Iteration {N})
- **Time**: {timestamp}
- **Progress**: {summary}
- **Files changed**: {count}
- **Next action**: Continue with {provider}

{content from /tmp/context-dump-90.md}
EOF
```

#### At 95% Capacity (Full)
```bash
# Supervisor sends instruction to agent:
cat > /tmp/context-dump-95.md << 'EOF'
## CRITICAL: Context Dump at 95% Capacity

**Timestamp**: {timestamp}
**Task**: {task_id}
**Tokens Remaining**: {remaining}K (CRITICAL)
**Tokens Consumed**: {consumed}K / {total}K

### Complete Execution Summary:
{full iteration history with key outputs per iteration}

### Complete File Manifest:
{all files created, modified, deleted with status}

### Validation History:
{all validation attempts + failures + reasons}

### Current Errors (if any):
{any active errors or issues}

### What needs to be finished:
{remaining acceptance criteria}

### Recommended Next Steps:
1. {step}
2. {step}
3. {step}
EOF

# Update both files
cat >> contexts/sandbox/{project}/project.md << 'EOF'

## CRITICAL Checkpoint at 95% Capacity (Iteration {N})
{content from /tmp/context-dump-95.md}
EOF

cat >> contexts/sandbox/{project}/{specific_project}.md << 'EOF'

## 95% Capacity Checkpoint
{detailed content including git diff, full file list, validation details}
EOF
```

#### At 98% Capacity (Emergency)
```bash
# Supervisor sends instruction:
cat > /tmp/context-dump-98.md << 'EOF'
## EMERGENCY: Context Dump at 98% Capacity

**Timestamp**: {timestamp}
**Status**: FORCE HANDOFF IMMINENT (40K tokens remaining)

### Critical State Summary:
{absolute minimum: current task, status, blockers}

### Last Successful State:
{commit hash or file snapshot}

### Outstanding Issues:
{any errors blocking completion}
EOF

# Final update
cat >> contexts/sandbox/{project}/project.md << 'EOF'

## EMERGENCY Checkpoint at 98% Capacity (Iteration {N})
**⚠️ FORCE HANDOFF INITIATED**
{content from /tmp/context-dump-98.md}
EOF
```

---

## Implementation Plan (4 Phases)

### Phase 1: Token Budget Tracking (Days 1-3)

**Goal**: Know exactly when agent approaches each threshold.

**Tasks**:
1. Create `src/domain/tasks/tokenBudget.ts`:
   - Implement `TaskTokenBudget` interface
   - Calculate remaining tokens = allocated - consumed
   - Track percent used
   - Implement threshold detection (80%, 90%, 95%, 98%)

2. Update `src/application/services/dispatcher.ts`:
   - Extract token counts from provider responses
   - Update `task.token_budget` after each execution
   - Call threshold checker after each update

3. Create `src/application/services/tokenThresholdChecker.ts`:
   - Detect when token_percent_used crosses 80%, 90%, 95%, 98%
   - Emit events for each threshold
   - Log timestamp and remaining tokens

4. Update supervisor state schema:
   - Add `token_budget` field to task state
   - Persist token tracking in Redis

**Acceptance Criteria**:
- ✓ Token counts extracted from provider metadata
- ✓ Thresholds detected correctly (within 1% margin)
- ✓ State persisted and survives restart
- ✓ Logging shows "Task {id} at 90% capacity: {remaining}K tokens"

**Timeline**: 3 days  
**Files**: `tokenBudget.ts`, `tokenThresholdChecker.ts`, update `dispatcher.ts`, update schemas

---

### Phase 2: Checkpoint Creation & Agent Context Dump (Days 4-9)

**Goal**: Auto-dump context to markdown files at each threshold.

**Tasks**:

1. Create `src/domain/checkpoints/contextCheckpoint.ts`:
   - Implement `ContextCheckpoint` interface
   - Implement `ContextDumpPayload` interface
   - Methods: `create()`, `toJSON()`, `forMarkdown()`

2. Create `src/infrastructure/adapters/logging/contextDumpAgent.ts`:
   - Generate dump command for agent
   - Format prompt injection: "Dump context to {paths} now"
   - Handle agent response (confirmation, error)

3. Create `src/infrastructure/adapters/sandbox/markdownUpdater.ts`:
   - Update `contexts/sandbox/{project}/project.md` with checkpoint
   - Update `contexts/sandbox/{project}/{specific_project}.md` with details
   - Create sections: "## Checkpoint at {capacity}% Capacity"
   - Append structured markdown

4. Create `src/application/services/checkpointOrchestrator.ts`:
   - Listens to threshold events (90%, 95%, 98%)
   - Orchestrates:
     - Generate context dump command
     - Send to current agent
     - Wait for agent to write markdown files
     - Create checkpoint JSON in `/tmp/context-checkpoints/`
     - Decide next action
   - Handles failures (agent doesn't write file, etc.)

5. Integrate into `src/domain/control/supervisor.ts`:
   - On threshold event, insert dump task into queue
   - Wait for agent to complete dump
   - Continue or fallback based on threshold

**Acceptance Criteria**:
- ✓ At 90% capacity, agent receives dump instruction
- ✓ Agent writes to `contexts/sandbox/{project}/project.md` with progress
- ✓ Agent writes to `contexts/sandbox/{project}/{specific_project}.md` with details
- ✓ Checkpoint JSON created with metadata
- ✓ File paths correctly resolved (sandbox CWD)
- ✓ Supervisor waits for agent completion before continuing
- ✓ Fallback decides: continue current, fallback provider, or helper

**Timeline**: 6 days (complex file I/O + agent coordination)  
**Files**: `contextCheckpoint.ts`, `contextDumpAgent.ts`, `markdownUpdater.ts`, `checkpointOrchestrator.ts`, update `supervisor.ts`

---

### Phase 3: Handoff Decision & Injection (Days 10-15)

**Goal**: Seamlessly switch to next agent with context.

**Tasks**:

1. Create `src/application/services/handoffStrategy.ts`:
   - Input: checkpoint at 90%, 95%, or 98%
   - Logic: 
     - At 90%: Can continue current agent (if tokens allow)
     - At 95%: Must prepare fallback
     - At 98%: Force handoff immediately
   - Output: decision (continue, fallback_provider, helper_agent)

2. Create `src/application/services/checkpointContextInjector.ts`:
   - Input: checkpoint, next agent/provider
   - Generate prompt injection:
     ```
     [Context Checkpoint: {checkpoint_id}]
     Iteration: {iteration}
     Progress Summary:
     {summary}
     
     Files created: {list}
     
     Continue task: {original_task}
     ```
   - Inject at BEGINNING of next prompt (before task)

3. Update `src/infrastructure/adapters/agents/providers/cliAdapter.ts`:
   - Accept checkpoint as optional parameter
   - Inject checkpoint context before dispatching to provider
   - Track handoff in telemetry

4. Update `src/application/services/dispatcher.ts`:
   - On fallback trigger (circuit breaker + checkpoint):
     - Load checkpoint from `/tmp/context-checkpoints/`
     - Pass to `cliAdapter` with injection flag
     - Log: "Handoff {task_id} from {provider1} to {provider2} with checkpoint {id}"

5. Update `src/domain/control/supervisor.ts`:
   - Route post-checkpoint tasks through handoff strategy
   - Handle all 3 outcomes (continue, fallback, helper)

**Acceptance Criteria**:
- ✓ At 90% checkpoint, supervisor decides: continue or prepare fallback
- ✓ At 95% checkpoint, supervisor selects fallback provider
- ✓ At 98% checkpoint, supervisor forces handoff immediately
- ✓ Checkpoint context injected into next agent's prompt
- ✓ Original task prompt still present (checkpoint prepended)
- ✓ Logging shows checkpoint ID + decision
- ✓ Handoff succeeds: next agent continues without re-explaining

**Timeline**: 6 days  
**Files**: `handoffStrategy.ts`, `checkpointContextInjector.ts`, update `cliAdapter.ts`, `dispatcher.ts`, `supervisor.ts`

---

### Phase 4: Testing, Validation & Documentation (Days 16-21)

**Goal**: Verify checkpoints work end-to-end; document for operators.

**Tasks**:

1. Unit Tests:
   - `tests/unit/domain/tokenBudget.test.ts`: Threshold detection
   - `tests/unit/domain/checkpoints/contextCheckpoint.test.ts`: Checkpoint creation
   - `tests/unit/services/handoffStrategy.test.ts`: Handoff decision logic

2. Integration Tests:
   - `tests/integration/checkpoints/contextDumpE2E.test.ts`:
     - Simulate task execution to 90% → verify dump + checkpoint
     - Simulate to 95% → verify fallback decision
     - Simulate to 98% → verify force handoff
   - `tests/integration/handoff/checkpointInjection.test.ts`:
     - Load checkpoint, inject into prompt
     - Verify original task prompt intact
     - Verify next agent can continue

3. Sandbox Tests:
   - Create test project in `tests/fixtures/e2e-context-window/`
   - Task that intentionally consumes many tokens
   - Verify checkpoints written to `contexts/sandbox/` markdown files
   - Verify files readable and structured

4. Documentation:
   - `docs/plans/context-window-exhaustion-handoff.md` (this file + updates)
   - Operator guide: "How to resume a task from checkpoint"
   - Developer guide: "Adding checkpoint support to new agent type"

5. Manual Testing:
   - Run long-running task, verify 90%, 95%, 98% checkpoints created
   - Verify markdown files updated at each stage
   - Trigger provider failure, verify fallback with checkpoint
   - Verify tokens_remaining is accurate

**Acceptance Criteria**:
- ✓ All unit tests pass
- ✓ All integration tests pass
- ✓ E2E checkpoint creation verified
- ✓ Markdown files correctly formatted
- ✓ Checkpoint restoration works
- ✓ Documentation complete and clear
- ✓ Operator can manually resume task from checkpoint

**Timeline**: 6 days (heavy testing + docs)  
**Files**: `*.test.ts` files, update main docs, create `context-window-exhaustion-handoff.md`

---

## Integration Points

### Control Loop (`src/domain/control/supervisor.ts`)
```
Main Loop:
1. Get task from queue
2. Execute agent/provider
3. [NEW] Check token budget → threshold?
4.     YES: Trigger checkpoint + handoff decision
5.     NO:  Continue normal flow
6. Validate response
7. Update state
8. Queue next iteration or complete
```

### Dispatcher (`src/application/services/dispatcher.ts`)
```
Before dispatch:
- Get token budget
- If checkpoint requested, load from `/tmp/context-checkpoints/`
- Pass checkpoint to cliAdapter

After response:
- Extract tokens_remaining from metadata
- Update TaskTokenBudget
- Check threshold → emit event
```

### Prompt Builder (`src/domain/agents/promptBuilder.ts`)
```
When injecting context:
- If checkpoint present:
  1. Prepend: [Checkpoint Summary]
  2. Append: [Original Task]
- Else:
  1. Build prompt normally
```

### State Persistence (`src/infrastructure/persistence/dragonflydb.ts`)
```
Fields to persist:
- task.token_budget (full TokenBudget object)
- task.checkpoints (array of checkpoint IDs created)
- task.last_handoff (timestamp, provider, reason)
```

### Logging (`src/infrastructure/adapters/logging/telemetry.ts`)
```
Log entries:
- "TOKEN_BUDGET": { task_id, provider, consumed, remaining, percent, threshold }
- "CHECKPOINT_CREATED": { checkpoint_id, reason, capacity_percent }
- "HANDOFF_DECISION": { task_id, from_provider, to_provider, checkpoint_id }
- "CONTEXT_DUMP_REQUESTED": { task_id, paths, status }
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Token count inaccurate (provider doesn't expose) | Medium | Premature/late handoff | Conservative 90% threshold gives buffer; monitor in telemetry |
| Agent doesn't write markdown files | Medium | Checkpoint data lost | Add timeout + fallback: supervisor writes summary if agent fails |
| Checkpoint file too large | Medium | Disk space issue | Compress history; keep only last 5 iterations; auto-cleanup old checkpoints |
| Fallback provider also exhausts context | Low | Repeated failures | Track per-provider budgets; choose provider with most remaining |
| Sensitive data in markdown dump | Low | Security leak | Redact secrets, .env, *.secret files from dump; sanitize PII patterns |
| Task stuck in loop (keeps handoff) | Low | Wasted effort | Add handoff counter; abort after 3 handoffs without progress |
| Operator manually modifies checkpoint file | Low | Corruption | Version checkpoint; validate before injection |

---

## Success Metrics

1. **Checkpoint Creation Accuracy**
   - ✓ 99%+ of tasks that reach 90% capacity trigger checkpoint
   - ✓ Checkpoints created within 5 seconds of threshold

2. **Markdown File Updates**
   - ✓ 95%+ of checkpoints update `project.md` correctly
   - ✓ 95%+ of checkpoints update `{specific_project}.md` correctly
   - ✓ Markdown files are valid, readable, properly formatted

3. **Handoff Success**
   - ✓ 90%+ of handoffs (fallback/fresh session) complete successfully
   - ✓ 80%+ of interrupted tasks (due to window exhaustion) complete after handoff
   - ✓ Avg. 5-10% fewer tokens used in handoff vs. re-explaining task

4. **Token Budget Tracking**
   - ✓ Token counts match provider metadata within 2% margin
   - ✓ Remaining tokens forecast accurate within 10%

5. **Operator Experience**
   - ✓ Operator can resume interrupted task from checkpoint doc
   - ✓ Checkpoint files are human-readable and actionable
   - ✓ Clear logging of all threshold events

---

## Configuration & Flags

```typescript
// config/tokenBudget.ts
export const TOKEN_BUDGET_CONFIG = {
  // Enable/disable entire feature
  ENABLED: true,
  
  // Provider-specific allocations (tokens)
  PROVIDER_LIMITS: {
    'gemini-2.0-pro': 1_800_000,      // 2M - 200K buffer
    'gemini-1.5-pro': 1_800_000,      // 2M - 200K buffer
    'gpt-4-turbo': 120_000,           // 128K - 8K buffer
    'claude-3.5-sonnet': 180_000,     // 200K - 20K buffer
    'copilot': 4_096,                 // Unknown, conservative
  },
  
  // Threshold percentages
  THRESHOLDS: {
    WARNING: 0.80,
    CHECKPOINT_90: 0.90,
    CHECKPOINT_95: 0.95,
    CHECKPOINT_98: 0.98,
  },
  
  // Context dump settings
  CONTEXT_DUMP: {
    ENABLED: true,
    MARKDOWN_UPDATE: true,            // Update project.md + specific.md
    CHECKPOINT_DIR: './tmp/context-checkpoints',
    MAX_HISTORY_LINES: 500,           // Keep last N iterations in dump
    COMPRESSION: 'gzip',               // Compress before save
    RETENTION_DAYS: 7,
  },
  
  // Handoff settings
  HANDOFF: {
    ENABLED: true,
    FORCE_AT_98_PERCENT: true,
    FALLBACK_PROVIDER_SELECTION: 'by_role_priority',
    TIMEOUT_MS: 30000,
  },
  
  // Logging
  LOGGING: {
    VERBOSE: false,                    // Log every token update
    LOG_THRESHOLDS: true,              // Log at each threshold
    LOG_HANDOFFS: true,
  },
};
```

---

## Operator Guide: Resuming from Checkpoint

### Scenario: Task Interrupted Due to Context Exhaustion

```bash
# Task was running, hit 98% capacity, got force handoff
# But new provider also failed

# Look at checkpoint files
ls -la contexts/sandbox/{project}/
  project.md                      # High-level summary
  {specific_project}.md          # Detailed state

# Read checkpoint summary
cat contexts/sandbox/{project}/project.md
  ## EMERGENCY Checkpoint at 98% Capacity (Iteration 14)
  **Last successful state**: Commit abc123
  **Outstanding issues**: Missing API routes registration
  **Recommended next steps**: ...

# Manual resume: Create new task with checkpoint context
supervisor task create \
  --goal "Complete the backend (see checkpoint in project.md)" \
  --checkpoint-file "contexts/sandbox/{project}/98p-checkpoint.json"

# OR: Modify task config to inject checkpoint
cat task-config.json
{
  "task_id": "resume-backend-v2",
  "goal": "...",
  "checkpoint_context": "contexts/sandbox/{project}/98p-checkpoint.json"
}
```

---

## Developer Guide: Adding Checkpoint Support to New Role

### Step 1: Define Role-Specific Dump Format

```typescript
// src/domain/roles/backendRole.ts
export const BACKEND_ROLE_DUMP = {
  checkpoint_sections: [
    'API_ROUTES',
    'DATABASE_MODELS',
    'MIDDLEWARE',
    'TESTS',
  ],
  
  files_to_track: [
    'src/**/*.ts',
    'src/**/*.js',
    'package.json',
    'tsconfig.json',
  ],
};
```

### Step 2: Implement Role-Specific Dump Instruction

```typescript
// In checkpointOrchestrator.ts
const dumpInstruction = generateDumpInstruction(task.role, checkpoint);
// For backend role: dump API structure, DB schema, middleware config
// For frontend role: dump component tree, routing setup, styles
// For helper role: dump validation results, error messages
```

---

## Timeline Summary

| Phase | Duration | Output | Dependencies |
|-------|----------|--------|--------------|
| Phase 1 | 3 days | Token budget tracking | None |
| Phase 2 | 6 days | Checkpoint creation + markdown dump | Phase 1 |
| Phase 3 | 6 days | Handoff decision + injection | Phase 1-2 |
| Phase 4 | 6 days | Tests + docs + validation | Phase 1-3 |
| **Total** | **21 days** | **Full feature** | Sequential |

**Start Date**: TBD  
**Projected Completion**: ~3 weeks from start

---

## Out of Scope (Future Enhancements)

- Dashboard for visualizing token consumption over time
- Automated alert notifications (Slack, email)
- Token budget optimization (ML-based estimation)
- Cross-task context sharing (security risk)
- Distributed checkpointing (multi-machine)

---

## Questions & Open Items

1. **Provider Token Exposure**: Do all CLI adapters expose token counts in metadata?
   - Gemini: ✓ Yes (in response metadata)
   - OpenRouter: ? (need to verify)
   - Copilot: ? (need to verify)
   - Cursor: ? (need to verify)
   - **Action**: Test each provider; estimate if not available

2. **Markdown Path Resolution**: How to correctly resolve `contexts/sandbox/{project}/{specific_project}.md`?
   - Need to extract project ID from task context
   - Need to derive specific_project from task goal
   - **Action**: Define path resolution logic in Phase 2

3. **Agent Dump Reliability**: What if agent doesn't write markdown file?
   - Timeout + fallback: supervisor writes summary
   - Or: require explicit confirmation from agent
   - **Action**: Decide in Phase 2 design review

4. **Checkpoint Cleanup**: How long to retain checkpoints?
   - Proposal: 7 days or until task marked "done"
   - Or: indefinite (archive older than 30 days)
   - **Action**: Define retention policy in config

5. **Token Estimation Accuracy**: How to estimate tokens if provider doesn't expose?
   - Rough formula: ~1.3 tokens per word (English)
   - For code: ~4 tokens per 3 chars
   - **Action**: Implement estimator as fallback

---

## Approval & Sign-Off

- **Proposed By**: Supervisor Core Team
- **Status**: Ready for Implementation
- **Requires Review By**: Architecture, Integration, QA
- **Estimated Effort**: 21 person-days

---

## References

- `supervisor-halt-operation-context-dump.md` (context dump format reference)
- `agent-switching-pre-context-injection.md` (brief context injection pattern)
- `session-reuse-optimization.md` (token monitoring baseline)
- `governance-observability-enhancement.md` (handoff contracts)
- `multi-agent-orchestration/agent-squad-analysis.md` (orchestration patterns)
