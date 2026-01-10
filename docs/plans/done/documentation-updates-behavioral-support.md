# Plan: Documentation Updates for Behavioral Task Support

## Overview

Multiple supervisor improvements have been implemented:
1. **Behavioral task support** (see [fix-behavioral-support.md](fix-behavioral-support.md))
2. **AST-based validation** (see [SUPERVISOR_AGENT_IMPROVEMENTS/ast-validation.md](SUPERVISOR_AGENT_IMPROVEMENTS/ast-validation.md) and [ast-adapter-strategy.md](SUPERVISOR_AGENT_IMPROVEMENTS/helper_docs/ast-adapter-strategy.md))
3. **Reduced retry/interrogation limits** for faster failure detection

This plan documents required updates to user-facing and architectural documentation to ensure operators understand these improvements.

## Problem Statement

- **Current State**: Code implementations are complete but undocumented
- **Risk**: Operators will repeat mistakes like testing-0091 (using behavioral tasks without explicit `task_type` field, expecting unlimited retries)
- **Gap**: No guidance on when/how to use behavioral tasks vs. coding tasks, no AST validation documentation, outdated retry/interrogation limits in docs
- **Impact**: Reduced system usability and higher support burden

## Documentation Updates Required

### 1. Update `docs/VALIDATION.md`

**Location**: `/supervisor/docs/VALIDATION.md`

**Section to Add**: New section after current validation rules

**Content**:
- Explain task type routing (behavioral vs. file-based)
- Show behavioral validation rules (greeting patterns, word count, separate responses)
- Provide examples:
  - ❌ Bad: "Greet" criteria on file-based task (searches codebase for greeting keyword)
  - ✅ Good: "Greet" criteria on behavioral task (checks response text for greeting)
- Show interrogation skip logic (behavioral tasks don't run file verification)
- Confidence scoring differences between validation types

**Headings**:
```
## Task Type-Aware Validation (New)
### Validation Routing by Task Type
### Behavioral Validation Rules
### File-Based Validation Rules (Existing)
### Why Interrogation Skips for Behavioral Tasks
### Confidence Scoring
```

### 2. Update `docs/ARCHITECTURE.md` or `docs/ARCHITECTURE_DETAILED.md`

**Location**: `/supervisor/docs/ARCHITECTURE_DETAILED.md` (preferred) or `/supervisor/docs/ARCHITECTURE.md`

**Section to Add**: In validation/interrogation flow section

**Content**:
- Add decision tree for task type detection
- Show validation routing diagram:
  ```
  Task → detectTaskType() → { behavioral | coding | config | testing | docs }
                                    ↓
                          Behavioral Path:
                          1. Run behavioral validator
                          2. Check response text only
                          3. Skip interrogation (no files to verify)
                                    ↓
                          Coding Path:
                          1. Run file-based validator (keyword/regex)
                          2. Optional: Run AST validator (if enabled)
                          3. Check files/diffs exist
                          4. If UNCERTAIN confidence → interrogate (max 1 round)
  ```
- Update control flow diagram to show `task.task_type !== 'behavioral'` check before interrogation
- **NEW**: Document AST validation layer (adapter pattern, ts-morph for TS/JS)
- **NEW**: Update retry limits (default: 1 retry, configurable via `task.retry_policy.max_retries`)
- **NEW**: Update interrogation limits (max 1 question per criterion (initial), 0 (final))

**Headings**:
```
### Validation Phase (Updated)
#### Task Type Detection & Routing
#### Behavioral Task Flow
#### Coding Task Flow
#### AST Validation (Optional Enhancement)
#### Retry & Interrogation Limits
```

### 3. Create New Guide: `docs/BEHAVIORAL_TASKS_GUIDE.md`

**Location**: `/supervisor/docs/BEHAVIORAL_TASKS_GUIDE.md` (new file)

**Purpose**: Comprehensive operator guide for creating and using behavioral tasks

**Sections**:

```markdown
# Behavioral Tasks Guide

## What Are Behavioral Tasks?

- Conversational/interactive tasks with no file artifacts
- Focus on agent response quality, not code changes
- Examples: "Greet the user", "Explain the system", "Answer questions"
- NOT suitable for: code generation, file creation, refactoring

## When to Use Behavioral Tasks

### ✅ Good Use Cases
- Agent personality testing ("Greet concisely", "Be professional")
- Conversational validation ("Respond to 3 questions")
- Documentation verification ("Explain the architecture")
- System knowledge probing ("Who maintains this?")
- Training/behavior verification ("Are you hallucinating?")

### ❌ Bad Use Cases
- Feature implementation ("Build a login form")
- Bug fixes ("Fix the null pointer exception")
- File modifications ("Update README")
- Code generation ("Create a service class")
- Anything producing file artifacts

## Creating Behavioral Tasks

### Task Definition

```json
{
  "task_id": "behavioral-greet-test",
  "task_type": "behavioral",
  "intent": "Test agent greeting",
  "instructions": "Provide a friendly greeting and introduce your capabilities.",
  "acceptance_criteria": [
    "Greet using hello/hi/welcome",
    "Response under 100 words",
    "Mention you are an AI assistant"
  ],
  "working_directory": "sandbox/easeclassifieds",
  "retry_policy": {
    "max_retries": 2
  }
}
```

### Task Type Field

**Field**: `task_type` (optional, string enum)

**Valid Values**:
- `"behavioral"` - Conversational, no files
- `"coding"` - Implementation, file-based (default if omitted)
- `"configuration"` - Setup/installation
- `"testing"` - Test execution
- `"documentation"` - Writing docs

**Default**: If omitted, auto-detects from intent/instructions keywords

### Auto-Detection

The system auto-detects task type based on keywords:

| Type | Detection Keywords |
|------|-------------------|
| behavioral | greet, hello, say, respond, explain, who are you |
| testing | test, spec, assertion, coverage, verify |
| configuration | configure, setup, environment, install, deploy |
| documentation | document, readme, write.*doc, guide |
| coding | (default) |

**Note**: Explicit `task_type` field always overrides auto-detection.

## Behavioral Validation Rules

### Available Criteria Patterns

| Criterion | Validation Method | Passes When |
|-----------|------------------|------------|
| "Greet" | Response text regex | Contains: hello, hi, welcome, greetings, hey |
| "Respond concisely" | Word count | Response ≤ 300 words (configurable) |
| "Respond separately per message" | Line count | Response has ≥ 2 separate paragraphs |
| Custom pattern | Regex match | Response matches provided regex pattern |

### Confidence Levels

- **HIGH**: Pattern found with clear evidence
- **MEDIUM**: Inferred from context (e.g., multiple greeting synonyms)
- **LOW**: Uncertain, requires interrogation (not applicable for behavioral tasks)
- **UNCERTAIN**: Missing evidence, interrogation attempted (behavioral tasks skip this)

**Behavioral Advantage**: No UNCERTAIN → no interrogation needed

## Interrogation Bypass

### Why Behavioral Tasks Skip Interrogation

Interrogation asks: "Where is the file that implements this?"

For behavioral tasks:
- ❌ No files to find (response is the implementation)
- ❌ No code paths to trace
- ❌ No git diffs to analyze

Therefore: **Behavioral tasks skip interrogation entirely**

### Control Flow

```
Task Validation
  ├─ If task_type === 'behavioral'
  │  ├─ Run behavioral validator
  │  ├─ Report: PASSED or FAILED (no interrogation)
  │  └─ Move to next iteration or success
  │
  └─ If task_type !== 'behavioral'
     ├─ Run file-based validator
     └─ If confidence is LOW/UNCERTAIN
        └─ Interrogate: "Where is the implementation?"
```

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Using File-Based Task for Behavioral Criteria

**Problem**:
```json
{
  "task_type": "coding",
  "acceptance_criteria": ["Greet"]
}
```

**Result**: System searches codebase for "Greet" keyword, fails when not found

**Solution**: Set `task_type: "behavioral"`

```json
{
  "task_type": "behavioral",
  "acceptance_criteria": ["Greet"]
}
```

### ❌ Pitfall 2: Invalid Model Names

**Problem**:
```json
{
  "agent_mode": "gemini-2.5-flash-lite"
}
```

**Error**: `option '--model <model>' argument 'gemini-2.5-flash-lite' is invalid`

**Valid Models**: claude-sonnet-4.5, claude-haiku-4.5, gemini-3-pro-preview, gpt-5.1, etc.

**Solution**: Use valid model name or omit field for auto-selection

### ❌ Pitfall 3: Vague Acceptance Criteria

**Problem**:
```json
{
  "acceptance_criteria": ["Be helpful"]
}
```

**Why It Fails**: "Helpful" doesn't match any recognized pattern

**Solution**: Use specific, pattern-matching criteria

```json
{
  "acceptance_criteria": [
    "Greet with hello/hi/welcome",
    "Respond concisely in under 100 words",
    "Answer at least 2 questions"
  ]
}
```

### ❌ Pitfall 4: Too Many Acceptance Criteria

**Problem**: 10+ criteria for a single response

**Why It Fails**: Agent can't meet all in one response without instruction tuning

**Solution**: Limit to 3-5 clear, achievable criteria

### ❌ Pitfall 5: Expecting Unlimited Retries

**Problem**: Setting `max_retries: 10` expecting thorough debugging

**Why It Fails**: System defaults to 1 retry (fast-fail strategy). Higher values waste resources on hopeless tasks.

**Solution**: Use max_retries: 1-2, rely on repeated error blocking (3 consecutive identical errors → task blocked)

**Note**: Interrogation now limited to 1 round per criterion (initial), 0 (final) for faster convergence.

## Examples

### Example 1: Greeting Test

```json
{
  "task_id": "behavioral-greet-001",
  "task_type": "behavioral",
  "intent": "Verify agent can greet politely",
  "instructions": "Say hello and briefly introduce yourself as a coding assistant.",
  "acceptance_criteria": [
    "Greet using hello, hi, or welcome",
    "Respond concisely (under 50 words)",
    "Mention being an AI assistant"
  ],
  "working_directory": "sandbox",
  "retry_policy": { "max_retries": 1 }
}
```

**Expected Response**: 
```
Hello! I'm a coding assistant here to help with your questions. What would you like to know?
```

**Validation**: ✅ PASS
- Contains "Hello" (greeting)
- 15 words (concise)
- Mentions "coding assistant" (AI role)

### Example 2: Explanation Test

```json
{
  "task_id": "behavioral-explain-001",
  "task_type": "behavioral",
  "intent": "Verify agent understands system architecture",
  "instructions": "Explain the supervisor validation system in 3-4 sentences.",
  "acceptance_criteria": [
    "Explains validation routing",
    "Mentions task types (behavioral, coding)",
    "Respond concisely (under 200 words)"
  ],
  "working_directory": "sandbox",
  "retry_policy": { "max_retries": 1 }
}
```

**Expected Response**:
```
The supervisor validates tasks using a dual-track system. Behavioral tasks check response content (greetings, conciseness) without file verification. Coding tasks search the codebase for implementation evidence. Tasks are routed based on their type, allowing specialized validation rules for each category.
```

**Validation**: ✅ PASS
- Explains routing (validation routing check)
- Mentions behavioral/coding types
- 67 words (concise)

## Troubleshooting

### Issue: "No matches found" during interrogation

**Cause**: Behavioral task was marked as `task_type: "coding"`

**Solution**: Change `task_type: "behavioral"`

### Issue: Invalid model error persists

**Cause**: Model name not in allowed list

**Solution**: Use `--allow-all-models` flag or verify model support

### Issue: Behavioral task keeps failing with vague criteria

**Cause**: Criteria like "Be helpful" don't match regex patterns

**Solution**: Use specific patterns: "Greet", "Respond concisely", "Answer questions"

## Integration with Supervisor

### Running Behavioral Tasks

```bash
# Via CLI
npx ts-node scripts/enqueue-task.ts behavioral-task.json

# Via Redis
redis-cli -h localhost -p 6499 LPUSH supervisor:queue '{"task_id":"behavioral-001","task_type":"behavioral",...}'
```

### Monitoring

```bash
# Watch task progress (skips interrogation)
npx ts-node scripts/dump-state.ts | jq '.current_task'

# Check validation results
npx ts-node scripts/dump-state.ts | jq '.validation_report'
```

### Success Indicators

- ✅ Task enters validation phase immediately
- ✅ No interrogation prompts generated
- ✅ Validation completes within 1-2 iterations
- ✅ Behavioral criteria all pass/fail quickly

## Related Documentation

- [VALIDATION.md](../VALIDATION.md) - Validation system details
- [ARCHITECTURE_DETAILED.md](../ARCHITECTURE_DETAILED.md) - Control loop design
- [fix-behavioral-support.md](fix-behavioral-support.md) - Implementation details
- [TASK_SCHEMA.json](../../TASK_SCHEMA.json) - Task definition schema
```

### 4. Add Reference to `TASK_SCHEMA.json`

**Location**: `/supervisor/TASK_SCHEMA.json`

**Current State**: Line 5 has task_type field documented

**Update Needed**: Add example and link to behavioral guide

```json
"task_type": {
  "type": "string",
  "description": "Task category affecting validation strategy. Auto-detected from intent/instructions if omitted.",
  "enum": ["coding", "behavioral", "configuration", "testing", "documentation"],
  "examples": [
    "behavioral - for conversational/response-based tasks",
    "coding - for file-based implementation tasks (default)",
    "testing - for test execution tasks"
  ],
  "reference": "See docs/BEHAVIORAL_TASKS_GUIDE.md for usage examples"
}
```

### 5. Create New Guide: `docs/AST_VALIDATION_GUIDE.md`

**Location**: `/supervisor/docs/AST_VALIDATION_GUIDE.md` (new file)

**Purpose**: Document AST-based validation strategy for technical operators

**Sections**:
```markdown
### Phase 1: Core Documentation Updates

- [ ] **1.1**: Add "Task Type-Aware Validation" section to `docs/VALIDATION.md`
  - [ ] Explain behavioral validator rules
  - [ ] Explain file-based validator rules
  - [ ] Explain AST validation layer (with reference to AST_VALIDATION_GUIDE.md)
  - [ ] Show interrogation skip logic
  - [ ] Add confidence scoring table
  - [ ] Update retry/interrogation limits (1 retry default, 1 interrogation round)

- [ ] **1.2**: Add routing diagram and decision tree to `docs/ARCHITECTURE_DETAILED.md`
  - [ ] Task type detection flow
  - [ ] Validation routing diagram (include AST layer)
  - [ ] Behavioral vs. coding control flows
  - [ ] Update interrogation section (1 round max (initial), 0 (final))
  - [ ] Add AST validation architecture overview
  - [ ] Document new retry defaults (1 retry, not 3)

### Phase 2: User Guides

- [ ] **2.1**: Create `docs/BEHAVIORAL_TASKS_GUIDE.md` (new file)
  - [ ] What/when/why sections
  - [ ] Task definition format with examples
  - [ ] Validation rules table
  - [ ] Common pitfalls with solutions
  - [ ] 2+ complete examples
  - [ ] Troubleshooting section
  - [ ] Update retry_policy examples (use max_retries: 1 or 2, not 3+)

- [ ] **2.2**: Create `docs/AST_VALIDATION_GUIDE.md` (new file)
  - [ ] Overview of AST validation vs keyword matching
  - [ ] When to use AST validation
  - [ ] Architecture overview (reference ast-adapter-strategy.md)
  - [ ] Supported file types (TS/JS/TSX/JSX)
  - [ ] Examples of AST validation rules
  - [ ] Future language support (Python, Go)

### Phase 3: Schema & References

- [ ] **3.1**: Update `TASK_SCHEMA.json` enum documentation
  - [ ] Add description to task_type field
  - [ ] Add reference link to BEHAVIORAL_TASKS_GUIDE.md
  - [ ] Provide examples for each type
  - [ ] Update retry_policy.max_retries description (default: 1)

- [ ] **3.2**: Add to `docs/RUNBOOK.md`
  - [ ] Behavioral tasks troubleshooting link
  - [ ] AST validation troubleshooting link
  - [ ] Quick reference table for retry/interrogation limits
  - [ ] Common errors and fixes (model names, retry exhaustion)
**Content**: 
- Link to BEHAVIORAL_TASKS_GUIDE.md for behavioral task issues
- Document new retry defaults (1 retry, not 3)
- Document new interrogation limits (1 round (initial), 0 (final))

## Implementation Checklist

### ✅ Phase 1: Core Documentation Updates - COMPLETED

- [x] **1.1**: Add "Task Type-Aware Validation" section to `docs/VALIDATION.md`
  - [x] Explain behavioral validator rules
  - [x] Explain file-based validator rules
  - [x] Show interrogation skip logic
  - [x] Add confidence scoring table

- [x] **1.2**: Add routing diagram and decision tree to `docs/ARCHITECTURE_DETAILED.md`
  - [x] Task type detection flow
  - [x] Validation routing diagram (lines 375-386)
  - [x] Behavioral vs. coding control flows
  - [x] Update interrogation section
  - [x] Add retry & interrogation limits (line 387-391)

### ✅ Phase 2: User Guides - COMPLETED

- [x] **2.1**: Create `docs/BEHAVIORAL_TASKS_GUIDE.md` (new file)
  - [x] What/when/why sections
  - [x] Task definition format with examples
  - [x] Validation rules table
  - [x] Common pitfalls with solutions
  - [x] 2+ complete examples
  - [x] Troubleshooting section
  - [x] 314 lines of comprehensive documentation

- [x] **2.2**: Create `docs/AST_VALIDATION_GUIDE.md` (new file)
  - [x] Overview of AST validation vs keyword matching
  - [x] When to use AST validation
  - [x] Architecture overview (adapter pattern)
  - [x] Supported file types (TS/JS/TSX/JSX)
  - [x] Troubleshooting section
  - [x] Fallback logic documented

### ✅ Phase 3: Schema & References - COMPLETED

- [x] **3.1**: Update `TASK_SCHEMA.json` enum documentation
  - [x] Add description to task_type field
  - [x] Add reference link to BEHAVIORAL_TASKS_GUIDE.md
  - [x] Provide examples for each type
  - [x] Update retry_policy.max_retries description (default: 1)

- [x] **3.2**: Add to `docs/RUNBOOK.md`
  - [x] Behavioral tasks troubleshooting link
  - [x] AST validation troubleshooting link
  - [x] Quick reference table for retry/interrogation limits
  - [x] Common errors and fixes

## Success Criteria

✅ **Documentation Complete When**:
1. Behavioral task creation guide exists and is clear enough for new operators
2. Why interrogation skips for behavioral tasks is explained
3. Common pitfalls document prevents repeat of testing-0091 pattern
4. Examples run through without modification
5. Schema documentation links to practical guide

✅ **Validation**:
- New operators can create behavioral task in < 5 minutes
- Schema documentation has clear type definitions
- All links between docs are correct
- Examples are accurate and tested

## Timeline

- **Phase 1 (Immediate)**: Create BEHAVIORAL_TASKS_GUIDE.md + AST_VALIDATION_GUIDE.md + update VALIDATION.md with new limits
- **Phase 2 (This Week)**: Update ARCHITECTURE_DETAILED.md (AST layer, retry/interrogation limits) + TASK_SCHEMA.json
- **Phase 3 (Next Week)**: Add to RUNBOOK.md + cross-reference check + verify all retry examples updated

## Notes

- These docs complement implementations in:
  - `fix-behavioral-support.md` (behavioral tasks)
  - `SUPERVISOR_AGENT_IMPROVEMENTS/ast-validation.md` (AST validation)
  - `SUPERVISOR_AGENT_IMPROVEMENTS/helper_docs/ast-adapter-strategy.md` (adapter pattern)
- Focus on **practical guidance** not architectural deep-dives (ARCHITECTURE_DETAILED.md for that)
- Use real examples from testing-0091 as cautionary tales (87+ iterations with invalid model + wrong task type)
- Keep behavioral guide accessible to non-technical operators
- **Critical**: Update ALL examples to use new defaults (max_retries: 1, not 3; interrogation: 1 round (initial), 0 (final))
- AST validation is **optional enhancement** - keyword/regex validation still works as fallback
