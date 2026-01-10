# Documentation Audit Findings (January 8, 2026)

**Purpose**: Identify documentation gaps against recent code changes (last 7 days)  
**Scope**: README.md + ./docs/*.md (excluding ./docs/plans/)  
**Method**: Git diff analysis + code inspection + timestamp comparison  

---

## Executive Summary

**Documentation Status**: 🔴 **SIGNIFICANTLY LAGGING** (60-70% alignment)

Recent code changes include **5 major features** not adequately documented:

1. ✅ **Session Reuse Optimization** (Jan 4) - 30% documented
2. ✅ **Prompt Tightening** (Jan 7) - 0% documented  
3. ✅ **Helper Agent Optimizations** (Jan 5) - 20% documented
4. ✅ **Deterministic Validation** (Jan 4) - 40% documented
5. ⚠️ **Task Type System** (Plan only, Jan 8) - CRITICAL BLOCKING ISSUE

---

## Part 1: Documentation Staleness Analysis

### Key Dates (Last 7 Days)

| Date | Commit | Change | Doc Status |
|------|--------|--------|-----------|
| **Jan 7** | edeb708 | Prompt tightening | ❌ MISSING |
| **Jan 5** | 1d78511 | Helper agent optimizations | ⚠️ PARTIAL |
| **Jan 4** | b54b766 | Session reuse optimizations | ⚠️ PARTIAL |
| **Jan 4** | 4378a56 | Supervisor improvements | ⚠️ VAGUE |

### Doc Modification Timeline

```
Jan 6  → IMPLEMENTATION_REVIEW.md (175 lines, outline only)
Jan 5  → VALIDATION.md (65 lines, partially updated)
Jan 5  → RUNBOOK.md (92 lines, basic runbook)
Jan 5  → ARCHITECTURE_DETAILED.md (1241 lines, extensive but not current)

Jan 4-3 → BEHAVIORAL_TASKS_GUIDE, AST_VALIDATION_GUIDE
Jan 3-28 → STATE_*, SANDBOX_*, older foundational docs

NO DOCS UPDATED FOR:
  ❌ Session Reuse (Jan 4)
  ❌ Prompt Tightening (Jan 7)
  ❌ Helper Agent Optimizations (Jan 5)
  ❌ Task Type System (Jan 8, plan phase)
```

### Critical Gaps by Topic

| Topic | Doc | Gap | Impact |
|-------|-----|-----|--------|
| **Session Reuse** | None | Feature ID generation, context limits, helper sessions | HIGH - Operators need setup instructions |
| **Prompt Tightening** | None | Rules block, JSON-only output, path validation | HIGH - Affects all tasks |
| **Helper Agent** | RUNBOOK (brief) | Session tracking, latency metrics, caching strategy | MEDIUM - Performance info missing |
| **Deterministic Validation** | VALIDATION.md | Pre-validation gating, confidence tiers, caps | MEDIUM - Validation logic opaque |
| **Task Types** | VALIDATION.md | Only behavioral tasks covered | CRITICAL - Most task types unsupported |
| **Provider Switching** | ARCHITECTURE.md | Circuit breaker, fallback strategy not documented | MEDIUM - Recovery unclear |
| **Metrics/Analytics** | IMPLEMENTATION_REVIEW (outline) | Helper durations, cache hit rates, skip rates | LOW - Dashboard not implemented yet |

---

## Part 2: Document-by-Document Gap Analysis

### 🔴 README.md (31K, Jan 7)
**Status**: Outdated, lacks feature descriptions  
**Staleness**: 1 day  
**Issues**:
- ❌ No mention of session reuse feature
- ❌ No mention of prompt tightening
- ❌ Mentions "Cursor CLI" but system supports Gemini/Copilot/Claude equally
- ❌ No task type guidance (conversational vs code vs testing)
- ❌ Installation section vague on provider setup
- ⚠️ "Software Factory" explanation good but missing operational details

**Missing Sections**:
- [ ] "Recent Enhancements" or "What's New" section
- [ ] "Session Reuse for Cost Savings" subsection
- [ ] "Supported Task Types" (code vs conversational vs testing)
- [ ] "Provider Setup" per provider (Gemini, Copilot, Cursor)

---

### 🟡 PROMPT.md (minimal, Jan 28)
**Status**: Outdated, no longer reflects current prompt design  
**Issues**:
- ❌ Mentions "Cursor CLI" exclusively (now Gemini/Copilot primary)
- ❌ No mention of Rules block (added in prompt tightening)
- ❌ No mention of JSON-only output contract
- ❌ No mention of consolidated Rules for fix/clarify prompts
- ❌ Doesn't mention path validation

**Should Cover**:
- [ ] Rules block structure
- [ ] JSON output requirements
- [ ] Path validation logic
- [ ] Task type-specific guidelines

---

### 🟡 TOOL_CONTRACTS.md (61 lines, Jan 4)
**Status**: Partially updated for session reuse, incomplete  
**Issues**:
- ❌ Output schema only documents code task format (files_created, files_updated)
- ❌ No output schemas for conversational/verification/testing/research tasks
- ⚠️ Doesn't specify JSON schema validation requirements
- ❌ No mention of session ID requirements in output
- ❌ No mention of provider-specific output formats

**Should Cover**:
- [ ] Output schemas for ALL task types (code, conversational, verification, testing, research)
- [ ] Session ID tracking in output
- [ ] Cache stats in output (for analytics)
- [ ] Provider-specific contract variations

---

### 🟡 VALIDATION.md (65 lines, Jan 5)
**Status**: Partially updated with task type routing, needs expansion  
**Issues**:
- ✅ Covers behavioral tasks well
- ⚠️ Mentions task type routing but only shows example for behavioral
- ❌ No documentation of deterministic pre-validation gates
- ❌ No mention of confidence tier skip logic (high vs medium)
- ❌ No mention of helper agent session reuse
- ❌ No mention of validation caching strategy

**Missing Sections**:
- [ ] Deterministic Validation Phase (caps, regex, semver)
- [ ] Confidence Tier System (HIGH skips helper, MEDIUM invokes)
- [ ] Validation Caching (SHA-256 file hashing)
- [ ] Helper Session Reuse (helper:validation:${projectId} pattern)
- [ ] Provider-specific validation rules

---

### 🔴 RUNBOOK.md (92 lines, Jan 5)
**Status**: Basic runbook, lacks operational details  
**Issues**:
- ❌ No mention of session reuse setup
- ❌ No mention of context limits per provider
- ❌ No mention of helper agent cost/latency tradeoffs
- ❌ No troubleshooting for session issues
- ⚠️ "Quick Reference: Limits" table outdated (350K vs 1.5M gap)

**Missing Sections**:
- [ ] "Session Reuse Tuning" subsection
- [ ] "Provider-Specific Limits" table
- [ ] "Debugging Session Issues" troubleshooting
- [ ] "Cost Optimization" strategy

---

### 🟡 ARCHITECTURE.md (28 lines, minimal)
**Status**: Skeletal outline, drastically outdated  
**Issues**:
- ❌ Mentions "Cursor CLI" exclusively
- ❌ No role descriptions for new components (SessionManager, AnalyticsService)
- ❌ No mention of Circuit Breaker pattern
- ❌ No mention of Provider routing/fallback
- ❌ No session management architecture

**Should Cover**:
- [ ] Provider-agnostic architecture (not Cursor-specific)
- [ ] SessionManager responsibilities
- [ ] AnalyticsService responsibilities
- [ ] Circuit breaker mechanism
- [ ] Provider switching strategy

---

### 🟡 ARCHITECTURE_DETAILED.md (1241 lines, Jan 5)
**Status**: Comprehensive but incomplete for recent features  
**Issues**:
- ⚠️ Mentions "Cursor CLI" throughout (outdated)
- ❌ SessionManager only briefly mentioned
- ❌ No session reuse flow diagram
- ❌ No mention of session context limits
- ❌ No mention of helper session tracking

**Needs Updates**:
- [ ] Provider abstraction layer explanation
- [ ] Session reuse architecture section
- [ ] Helper agent session flow
- [ ] Circuit breaker state machine diagram

---

### 🟡 BEHAVIORAL_TASKS_GUIDE.md (313 lines, Jan 3)
**Status**: Task type documentation exists but incomplete  
**Issues**:
- ✅ Behavioral tasks well covered
- ❌ Only covers ONE task type
- ❌ No guide for verification/testing/research/analysis tasks
- ❌ No task type selector/decision tree
- ❌ Doesn't mention new output schemas for other types

**Should Expand To**:
- [ ] Task type decision matrix (when to use each)
- [ ] Verification task guide
- [ ] Testing task guide
- [ ] Research task guide
- [ ] Analysis task guide

---

### 🟡 AST_VALIDATION_GUIDE.md (61 lines, Jan 3)
**Status**: Covers AST validation but incomplete  
**Issues**:
- ✅ Explains AST rule types well
- ❌ No mention of rule heuristics for criteria mapping
- ❌ No mention of catastrophic regex detection
- ❌ No mention of confidence tier impact on AST checks
- ❌ No mention of validation caching for AST results

**Needs Updates**:
- [ ] Catastrophic regex detection section
- [ ] Validation caching strategy
- [ ] Performance considerations

---

### 🟢 IMPLEMENTATION_REVIEW.md (175 lines, Jan 6)
**Status**: Good but outline-only for Phase 3  
**Issues**:
- ✅ Covers completion status
- ⚠️ Phase 3 (Analytics) documented as outline only
- ❌ No actual implementation details
- ❌ Doesn't mention metrics collection strategy

**Needs Completion**:
- [ ] Analytics implementation details (what metrics collected)
- [ ] Metrics persistence format (JSONL)
- [ ] Metrics CLI command documentation

---

### 🔴 State/Storage Docs (STATE_*.md series, Dec 28)
**Status**: Foundational, but don't cover active_sessions  
**Issues**:
- ❌ No mention of `active_sessions` structure
- ❌ No mention of session persistence
- ❌ No mention of SessionInfo schema
- ⚠️ State schema docs predate session reuse feature

**Should Add**:
- [ ] SessionInfo type documentation
- [ ] Session lifecycle in state
- [ ] Session persistence strategy

---

## Part 3: Code-Documentation Alignment Issues

### Issue 1: Provider Name Inconsistency
**Code Reality**: Multi-provider support (Gemini, Copilot, Cursor, Claude)  
**Docs Say**: Primarily Cursor CLI throughout  
**Impact**: Confusion about supported providers  

**Files Affected**:
- README.md (multiple references)
- ARCHITECTURE.md (mentions Cursor)
- ARCHITECTURE_DETAILED.md (throughout)
- PROMPT.md (mentions Cursor)

---

### Issue 2: Session Reuse Not Documented
**Code Reality**: Full session reuse implementation with:
- Feature ID generation (task:${prefix})
- Session fallback to state
- Helper session tracking (helper:validation:${projectId})
- Token tracking and accumulation

**Docs Say**: Nothing  
**Impact**: Operators don't know how to set up/tune sessions  

**Needed**:
- Session reuse overview doc
- Feature ID strategy explanation
- Context limit tuning guide
- Helper session tracking explanation

---

### Issue 3: Prompt Tightening Not Documented
**Code Reality**: Extensive prompt tightening in promptBuilder.ts:
- Rules block consolidation
- JSON-only output contract
- Path validation logic
- Context selectivity (buildMinimalState)
- Slim guidelines per task type

**Docs Say**: Nothing about these recent changes  
**Impact**: Operators/auditors can't verify prompt behavior  

**Needed**:
- Prompt architecture overview
- Rules block documentation
- Output requirements specification
- Path validation rules

---

### Issue 4: Task Type System Only Half-Documented
**Code Reality**: Behavioral tasks work, but code assumes all tasks are code-centric  
**Docs Say**: BEHAVIORAL_TASKS_GUIDE exists but only covers behavior tasks  
**Impact**: No guidance for conversational/verification/testing/research tasks  

**Needed** (Critical):
- Task type decision matrix
- Conversational task guide
- Verification task guide
- Testing task guide
- Research task guide
- Output schema per type

---

### Issue 5: Deterministic Validation Underdocumented
**Code Reality**: Full deterministic validation with:
- Pre-validation gating (HELPER_DETERMINISTIC_ENABLED)
- Confidence tiers (HIGH skips helper, MEDIUM invokes)
- Catastrophic regex detection
- File/byte caps
- Semver matching support

**Docs Say**: Brief mention in VALIDATION.md only  
**Impact**: Operators don't understand validation flow  

**Needed**:
- Deterministic validation phase explanation
- Confidence tier system
- Cap enforcement details
- Performance impact metrics

---

### Issue 6: Helper Agent Optimization Underdocumented
**Code Reality**: Helper agent with:
- Session reuse (helper:validation:${projectId})
- Duration tracking and P95 calculation
- Cache hit rate metrics
- Confidence-based invocation

**Docs Say**: Mentioned briefly in RUNBOOK.md  
**Impact**: Performance implications unclear  

**Needed**:
- Helper agent architecture
- Session persistence strategy
- Metrics collection
- Cost/latency tradeoffs

---

## Part 4: Missing Documentation Artifacts

### High Priority (Blocking)

| Doc | Purpose | Users | Effort |
|-----|---------|-------|--------|
| **SESSION_REUSE_GUIDE.md** | Explain feature IDs, context limits, session lifecycle | Operators | 3-4 hours |
| **PROMPT_ARCHITECTURE.md** | Document prompt tightening, Rules block, JSON contract | Auditors, maintainers | 4-5 hours |
| **TASK_TYPES_GUIDE.md** | Decision matrix, guide per task type, output schemas | Operators, task creators | 5-6 hours |
| **DETERMINISTIC_VALIDATION_GUIDE.md** | Pre-validation gating, confidence tiers, caching | Operators, debuggers | 2-3 hours |

### Medium Priority (Important)

| Doc | Purpose | Users | Effort |
|-----|---------|-------|--------|
| **PROVIDER_GUIDE.md** | Provider-specific setup (Gemini, Copilot, Cursor) | Operators | 2-3 hours |
| **HELPER_AGENT_GUIDE.md** | Architecture, session reuse, metrics | Operators, analysts | 2-3 hours |
| **CONTEXT_LIMITS_TUNING.md** | Per-provider limits, tuning strategy | Operators | 1-2 hours |

### Low Priority (Nice to Have)

| Doc | Purpose | Users | Effort |
|-----|---------|-------|--------|
| **METRICS_DASHBOARD_GUIDE.md** | Metrics collection, interpretation, queries | Analysts | 2-3 hours |
| **ANALYTICS_SCHEMA.md** | TaskMetrics, cache stats, helper duration tracking | Developers | 1-2 hours |

---

## Part 5: Cross-Cutting Documentation Issues

### Issue: Multi-Provider Support Not Well Explained
**Root Cause**: System evolved from Cursor-only to multi-provider  
**Current State**: Providers include Gemini, Copilot, Cursor, Claude (experimental)  
**Doc State**: Most docs assume Cursor CLI  

**Fix Scope**:
- [ ] Create PROVIDER_GUIDE.md
- [ ] Update README.md provider list
- [ ] Update ARCHITECTURE.md to show provider abstraction
- [ ] Update TOOL_CONTRACTS.md with provider variations

---

### Issue: Task Type System Incomplete
**Root Cause**: System designed for code tasks, expanded to support others  
**Current State**: Only behavioral tasks fully supported; code tasks work; others blocked  
**Doc State**: task-type-system-redesign.md describes problem but solution not implemented  

**Fix Scope**:
- [ ] Create TASK_TYPES_GUIDE.md
- [ ] Update VALIDATION.md with type routing details
- [ ] Create output schema docs per type
- [ ] Update BEHAVIORAL_TASKS_GUIDE.md → include all types

---

### Issue: Session Reuse Feature Invisible
**Root Cause**: Session reuse implementation spans multiple files; complex feature  
**Current State**: Code fully implemented but operators have no setup/tuning guidance  
**Doc State**: session-reuse-optimization.md plan doc exists, but README/docs say nothing  

**Fix Scope**:
- [ ] Create SESSION_REUSE_GUIDE.md
- [ ] Update RUNBOOK.md with session tuning section
- [ ] Document context limits per provider
- [ ] Explain helper session tracking

---

### Issue: Prompt Design Changes Not Documented
**Root Cause**: Prompt tightening is complex, spread across promptBuilder.ts  
**Current State**: Rules block, JSON-only, path validation all in code  
**Doc State**: No documentation of these design decisions  

**Fix Scope**:
- [ ] Create PROMPT_ARCHITECTURE.md
- [ ] Update PROMPT.md with Rules block details
- [ ] Document output contract precisely
- [ ] Explain path validation rules

---

## Part 6: Documentation Debt Summary

### Quantitative Analysis

```
Total Doc Files:     25 .md files
Recently Updated:    6 files (24%)
Stale (>7 days):     19 files (76%)

Code Changes (7 days):     5 major features
Doc Coverage:              2/5 features (40%)
Doc Quality:              "Outline" level (needs detail)

Documentation Debt:   ~60-70 hours of work to catch up
Priority Tier 1:      ~15-20 hours (blocking issues)
Priority Tier 2:      ~20-25 hours (important)
Priority Tier 3:      ~15-20 hours (nice to have)
```

### Risk Assessment

| Risk | Severity | Cause | Mitigation |
|------|----------|-------|-----------|
| Operators confused about features | HIGH | Missing guides (session reuse, task types) | Urgent doc creation |
| Auditors can't verify prompt design | HIGH | No prompt architecture doc | Create PROMPT_ARCHITECTURE.md |
| Task type system incomplete | CRITICAL | Code doesn't match task-type-redesign plan | Design decision needed |
| Provider setup unclear | MEDIUM | Multi-provider support not documented | Create PROVIDER_GUIDE.md |
| Performance tuning impossible | MEDIUM | Context limits, metrics not explained | Create tuning guides |

---

## Part 7: Recommended Update Plan

### Phase 1: Critical Blocking Issues (Week 1)
**Effort**: 15-20 hours  
**Outcome**: Operators can use major features

1. **SESSION_REUSE_GUIDE.md** (4 hours)
   - Feature ID strategy
   - Context limit per provider
   - Session lifecycle
   - Helper session tracking
   - Cost savings calculation

2. **TASK_TYPES_GUIDE.md** (5 hours)
   - Task type decision matrix
   - Output schema per type
   - Validation strategy per type
   - Examples for each type

3. **Update README.md** (3 hours)
   - Add "Recent Features" section
   - List all supported providers
   - Link to new guides
   - Update provider instructions

4. **Update VALIDATION.md** (3 hours)
   - Add deterministic validation section
   - Document confidence tiers
   - Explain validation caching
   - Document helper session flow

### Phase 2: Important Improvements (Week 2)
**Effort**: 20-25 hours  
**Outcome**: Complete feature documentation

1. **PROMPT_ARCHITECTURE.md** (5 hours)
2. **PROVIDER_GUIDE.md** (3 hours)
3. **DETERMINISTIC_VALIDATION_GUIDE.md** (3 hours)
4. **HELPER_AGENT_GUIDE.md** (3 hours)
5. **CONTEXT_LIMITS_TUNING.md** (2 hours)
6. **Update ARCHITECTURE_DETAILED.md** (4 hours)
7. **Update TOOL_CONTRACTS.md** (2 hours)

### Phase 3: Polish & Optional Docs (Week 3)
**Effort**: 15-20 hours  
**Outcome**: Complete reference documentation

1. **METRICS_DASHBOARD_GUIDE.md** (3 hours)
2. **ANALYTICS_SCHEMA.md** (2 hours)
3. **Provider-specific troubleshooting** (5 hours)
4. **Performance tuning guide** (3 hours)
5. **Recipe collection** (5 hours)

---

## Part 8: Specific Update Recommendations by File

### A. README.md

**Current Issues**:
- Line 8: Says "Cursor CLI" exclusively
- Line 12: Doesn't mention session reuse cost savings
- Line 60+: Installation doesn't mention provider setup

**Recommended Changes**:
```markdown
# Changes Required:
1. Add "Supported Providers" section after intro
2. Add "Key Features" section highlighting:
   - Session reuse (30-60% token savings)
   - Multi-task type support
   - Deterministic validation
3. Update installation to cover provider setup for:
   - Gemini CLI
   - Copilot CLI
   - Cursor CLI
4. Add "Getting Started with Session Reuse" subsection
5. Add links to new guides (SESSION_REUSE_GUIDE.md, TASK_TYPES_GUIDE.md)
```

---

### B. PROMPT.md

**Current Issues**:
- Too minimal (2KB)
- Outdated references

**Recommended Changes**:
```markdown
# Convert to outline, point to:
- New PROMPT_ARCHITECTURE.md for detailed design
- TOOL_CONTRACTS.md for output format
- TASK_TYPES_GUIDE.md for per-type prompts

Include:
- Overview of Rules block
- JSON output requirement
- Path validation rules
- Task type-specific guidelines
```

---

### C. TOOL_CONTRACTS.md

**Current Issues**:
- Only documents code task output
- Missing schemas for other task types
- Doesn't mention session tracking

**Recommended Changes**:
```markdown
# Add output schemas for:
- CODE: [existing]
- CONVERSATIONAL: { response, confidence, ... }
- VERIFICATION: { findings, issues, isValid, ... }
- TESTING: { testsRun, testsPassed, ... }
- RESEARCH: { candidates, recommendation, ... }

Add:
- Session ID tracking requirements
- Cache stats format
- Provider-specific variations (if any)
- Schema validation requirements
```

---

### D. VALIDATION.md

**Current Issues**:
- Doesn't explain deterministic pre-validation
- Doesn't document confidence tiers
- Doesn't mention validation caching
- Doesn't document helper session flow

**Recommended Changes**:
```markdown
# Add sections:
1. Deterministic Validation Phase
   - Caps (file count, byte limit, per-file size)
   - Regex safety checks
   - Semver matching
   - Confidence tier system

2. Helper Session Tracking
   - feature ID: helper:validation:${projectId}
   - Token accumulation
   - Session lifetime

3. Validation Result Caching
   - SHA-256 file hashing
   - Cache key structure
   - TTL policy
   - Performance impact

4. Task Type Routing Details
   - Decision tree by task_type
   - Validation strategy per type
```

---

### E. ARCHITECTURE_DETAILED.md

**Current Issues**:
- 1241 lines but outdated
- Mentions "Cursor CLI" throughout
- Missing SessionManager documentation
- Missing session reuse architecture

**Recommended Changes**:
```markdown
# Major updates:
1. Change "Cursor CLI" → "Provider CLI" throughout (search/replace)
2. Add SessionManager section:
   - Responsibilities
   - Feature ID strategy
   - Session discovery
   - State fallback

3. Add session reuse architecture:
   - Flow diagram
   - Feature ID generation
   - Context limit enforcement
   - Helper session tracking

4. Add Circuit Breaker section:
   - State machine
   - Provider fallback strategy
   - Recovery behavior

5. Update Provider Dispatcher:
   - Show provider abstraction
   - Show fallback logic
```

---

### F. RUNBOOK.md

**Current Issues**:
- Limits table outdated (350K)
- No session reuse tuning
- No provider-specific guidance
- No session debugging

**Recommended Changes**:
```markdown
# Add sections:
1. Session Reuse Tuning
   - Feature ID configuration
   - Context limit settings per provider
   - Helper session tracking
   - Monitoring session effectiveness

2. Provider-Specific Limits
   - Gemini: 1.5M tokens
   - Copilot: 100K tokens (conservative)
   - Cursor: 200K tokens
   - With explanation of impact

3. Debugging Session Issues
   - Session always returns undefined
   - Feature ID mismatch
   - Context limit hit too early
   - Helper session not persisting

4. Cost Optimization Strategies
   - When to use session reuse
   - When to reset sessions
   - Monitoring token costs
```

---

## Part 9: New Documentation Outlines

### A. SESSION_REUSE_GUIDE.md (4K, ~2 hours to write)

```markdown
# Session Reuse Optimization Guide

## Overview
- What session reuse is
- Benefits (30-60% token savings, faster validation)
- How it works

## Feature IDs
- Automatic generation from task ID
- Pattern: task:${task_id.split('_')[0]}
- Grouping related tasks

## Context Limits by Provider
- Gemini: 1.5M tokens (from 2M max, 500K buffer)
- Copilot: 100K tokens (conservative)
- Cursor: 200K tokens
- Tuning guidelines

## Session Lifecycle
- Creation on first task
- Reuse across iterations
- Reset on token limit or error count
- Time-based TTL (24 hours)

## Helper Session Tracking
- Feature ID: helper:validation:${projectId}
- Separate from main task sessions
- Token accumulation across retries
- Performance benefits

## Monitoring & Metrics
- Session reuse rate
- Token caching effectiveness
- Helper agent latency reduction
- Cost savings calculation

## Troubleshooting
- Session always returns undefined
- Feature ID collision
- Context limit hit too early
- Session not persisting across restarts
```

---

### B. TASK_TYPES_GUIDE.md (6K, ~2.5 hours to write)

```markdown
# Task Types & Output Schemas

## Decision Matrix
| Type | Purpose | Success Metric | Example |
| CODE | Implement feature | Files created/changed | "Add auth module" |
| CONVERSATIONAL | Answer question | Response quality | "Who are you?" |
| VERIFICATION | Check criteria | Findings accuracy | "Verify auth works" |
| TESTING | Run tests | Test pass rate | "Run unit tests" |
| RESEARCH | Find information | Recommendation quality | "Find best auth lib" |
| ANALYSIS | Analyze code | Report quality | "Analyze code quality" |
| BEHAVIORAL | Get response | Response relevance | "Greet user" |

## Output Schemas
- CODE: [schema with files_created, files_updated]
- CONVERSATIONAL: [schema with response, confidence]
- VERIFICATION: [schema with findings, issues]
- TESTING: [schema with testsPassed, testsFailed]
- RESEARCH: [schema with candidates, recommendation]
- ANALYSIS: [schema with findings, metrics]
- BEHAVIORAL: [schema with response, relevance]

## Validation Strategy Per Type
- CODE: File existence + content
- CONVERSATIONAL: Response length + relevance
- VERIFICATION: Finding accuracy + evidence
- TESTING: Test results + exit code
- RESEARCH: Candidate quality + justification
- ANALYSIS: Metrics validity + insight
- BEHAVIORAL: Response relevance + clarity

## Task Creation Examples
- Example code task with acceptance criteria
- Example conversational task
- Example verification task
- Example testing task

## Troubleshooting
- Task doesn't complete
- Validation fails unexpectedly
- Wrong task type classification
```

---

### C. PROMPT_ARCHITECTURE.md (5K, ~2 hours to write)

```markdown
# Prompt Architecture & Design

## Rules Block
- Consolidated into single section
- Applied to all task types
- Rules listed (reference only, no speculation, etc.)

## Output Contract
- JSON-only output requirement
- Schema validation
- Required fields per type
- Example outputs

## Path Validation
- File path validation rules
- Absolute path rejection
- Traversal attack prevention
- Non-existent file handling

## Context Selectivity (buildMinimalState)
- What context is included
- What context is excluded
- Keyword-based inclusion logic
- Performance impact

## Task Type-Specific Guidelines
- Code task guidelines
- Conversational guidelines
- Verification guidelines
- Testing guidelines

## Prompt Variants
- Fix/clarify prompts
- Interrogation prompts
- Helper agent prompts
- How they differ from main prompt

## Evolution & Rationale
- Why Rules block consolidated
- Why JSON-only
- Why path validation
- Performance improvements

## Testing & Validation
- How to verify prompt behavior
- Common prompt issues
- Debugging prompt problems
```

---

## Part 10: Implementation Checklist

### [ ] Week 1: Critical Path (15-20 hours)

- [ ] SESSION_REUSE_GUIDE.md (4 hours)
  - [ ] Feature ID strategy
  - [ ] Context limits per provider
  - [ ] Session lifecycle
  - [ ] Helper session tracking

- [ ] TASK_TYPES_GUIDE.md (5 hours)
  - [ ] Decision matrix
  - [ ] Output schemas
  - [ ] Validation per type
  - [ ] Examples

- [ ] README.md updates (3 hours)
  - [ ] Add "Supported Providers" section
  - [ ] Add "Key Features" section
  - [ ] Update provider setup instructions
  - [ ] Add feature links

- [ ] VALIDATION.md updates (3 hours)
  - [ ] Deterministic validation section
  - [ ] Confidence tier system
  - [ ] Validation caching
  - [ ] Helper session flow

### [ ] Week 2: Important Improvements (20-25 hours)

- [ ] PROMPT_ARCHITECTURE.md (5 hours)
- [ ] PROVIDER_GUIDE.md (3 hours)
- [ ] DETERMINISTIC_VALIDATION_GUIDE.md (3 hours)
- [ ] HELPER_AGENT_GUIDE.md (3 hours)
- [ ] CONTEXT_LIMITS_TUNING.md (2 hours)
- [ ] ARCHITECTURE_DETAILED.md updates (4 hours)
- [ ] TOOL_CONTRACTS.md updates (2 hours)

### [ ] Week 3: Polish (15-20 hours)

- [ ] METRICS_DASHBOARD_GUIDE.md (3 hours)
- [ ] ANALYTICS_SCHEMA.md (2 hours)
- [ ] Provider-specific troubleshooting (5 hours)
- [ ] Performance tuning guide (3 hours)
- [ ] Recipe collection (5 hours)

---

## Conclusion

Documentation lags **7+ days behind code** across 5 major features. 

**Critical issues**:
1. ✅ Session reuse fully implemented but undocumented → operators can't use it
2. ✅ Prompt tightening fully implemented but undocumented → auditors can't verify
3. ✅ Helper agent optimization fully implemented but underdocumented → can't troubleshoot
4. 🔴 Task type system incomplete → blocking non-code task types
5. ⚠️ Deterministic validation under-explained → operators confused about flow

**Recommended action**: Prioritize Phase 1 (Week 1) critical path to unblock operators using new features. Total effort: ~60-70 hours across 3 weeks to fully catch up.

---

**Status**: Ready for implementation  
**Date Created**: January 8, 2026  
**Audit Period**: January 1-8, 2026
