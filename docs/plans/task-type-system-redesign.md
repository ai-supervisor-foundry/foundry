# System Deep Analysis: Task Types, Validation Contracts, and Schema Adjustment

**Date**: January 8, 2026  
**Scope**: Supervisor task execution system validation contracts and task-type handling  
**Severity**: CRITICAL - System is task-type-blind and code-centric

---

## Executive Summary

The supervisor system is designed exclusively for **code execution tasks** and fails on other task types due to:
1. **Single rigid validation schema** treating all tasks as file-modification tasks
2. **Prompt over-engineering** biased toward code/structural output
3. **No task-type classification** - routes everything through same pipeline
4. **Implicit role assumption** - assumes agent is always "coder"
5. **Semantic blindness** - validates structure, not meaning

**Impact**: 
- ✅ Code tasks: work fine (files changed = success)
- ❌ Conversational tasks: fail (no "summary" response, expects file changes)
- ❌ Verification tasks: fail (need analysis, not file creation)
- ❌ Research tasks: fail (need information, not code)
- ❌ Testing tasks: fail (need assertions, not files)

---

## Part 1: Current System Architecture (Code-Centric)

### 1.1 Current Task Schema

```json
{
  "task_id": "task-xxx",
  "description": "Build feature X",
  "intent": "implementation|verification|...",
  "acceptance_criteria": ["Criterion 1", "Criterion 2"],
  "sandbox_root": "sandbox"
}
```

### 1.2 Current Output Schema

```json
{
  "status": "completed|failed",
  "files_created": [],        // ← CODE-CENTRIC
  "files_updated": [],        // ← CODE-CENTRIC
  "changes": [],              // ← CODE-CENTRIC
  "neededChanges": true|false,
  "summary": "One sentence"
}
```

### 1.3 Current Validation Logic

```
IF status == "completed" AND (files_created.length > 0 OR files_updated.length > 0):
  ✅ Task succeeded
ELSE IF status == "completed" AND (files_created.length == 0 AND files_updated.length == 0):
  ⚠️ Task completed but no changes (suspicious but allowed)
ELSE IF status == "failed":
  ❌ Task failed
```

**Problem**: Assumes success = file changes. For greeting task, no files = "completed but empty" = wrong.

---

## Part 2: Task Type Analysis

### 2.1 Task Types NOT Covered

| Task Type | Example | Success Metric | Current Output Fit |
|-----------|---------|---------------|--------------------|
| **CODE** | "Implement auth module" | Files created/changed | ✅ Perfect |
| **CONVERSATIONAL** | "Hello, who are you?" | Agent responds with answer | ❌ Wrong (no files field) |
| **VERIFICATION** | "Verify auth module" | Analysis/findings reported | ❌ Wrong (expects files, not analysis) |
| **TESTING** | "Run unit tests" | Test results/assertions | ❌ Wrong (expects files, not test results) |
| **RESEARCH** | "Find best auth library" | Information/recommendations | ❌ Wrong (expects files, not info) |
| **ANALYSIS** | "Analyze code quality" | Report/metrics | ❌ Wrong (expects files, not report) |
| **PLANNING** | "Design API schema" | Design artifact | ⚠️ Partial (can save design file, but schema rigid) |
| **REVIEW** | "Review PR changes" | Review comments/approval | ❌ Wrong (expects files, not review) |

### 2.2 Why Current System Fails on Non-Code Tasks

#### Example: Conversational Task

**Task**: "Hello, who are you?"
**Current Prompt**: Code-centric rules + "only from context" + "do not speculate"
**Model Logic**: "No files in context, rules say don't speculate, no code to write → status=completed, files=[]"
**Result**: ❌ No greeting provided

**Root Cause Chain**:
1. Prompt assumes all tasks are code tasks
2. Model interprets "who are you?" as code task (files expected)
3. Context has no greeting information
4. Rules forbid speculation/inference
5. Model defaults to "no files changed"
6. Output is valid JSON but meaningless (no greeting)

---

## Part 3: Prompt Bias Analysis

### 3.1 Code-Centric Rules (from current prompt)

```
"Reference only files that exist in sandbox_root; verify before mentioning"
                          ↓
        (assumes task involves files)

"code changes + final JSON block only"
                          ↓
        (assumes output is code)

"If you made no file changes, use empty arrays"
                          ↓
        (assumes file changes are the success metric)
```

### 3.2 Anti-Generative Rules

```
"Do NOT paraphrase, infer, or speculate beyond what is explicitly stated"
                          ↓
        (kills conversational tasks)

"Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT"
                          ↓
        (kills research/analysis tasks that need external knowledge)
```

### 3.3 Phi-4-Mini Model Behavior Under These Constraints

**Model sees**:
1. Structural constraint: "format: 'json'"
2. Role constraint: "code agent with files"
3. Negative constraint: "do not speculate"
4. Output constraint: "code changes + JSON"

**Model reasons**: "Input lacks code context, rules forbid speculation, JSON structure requires valid schema → safest path is valid JSON with empty arrays."

**Result**: Structurally correct, semantically empty.

---

## Part 4: Validation Contract Problems

### 4.1 Current Validation Contract

**Input Contract** (implicit):
- Task must describe a code/file modification
- Acceptance criteria must be file-checkable
- Success = detectable via file presence/content

**Output Contract** (explicit):
- Must be valid JSON
- Must have files_created, files_updated, changes arrays
- Success = status == "completed"

**Problem**: Contracts assume all tasks are code tasks.

### 4.2 What Each Task Type Actually Needs

#### CODE Task Contract

```
Input:  "Implement feature X"
Output: {
  files_created: ["src/feature.ts"],
  files_updated: ["src/index.ts"],
  changes: ["src/feature.ts", "src/index.ts"]
}
Validation: Check files exist + contain expected patterns
```

#### CONVERSATIONAL Task Contract

```
Input:  "Who are you?"
Output: {
  response: "I am a code assistant...",
  isDirectAnswer: true,
  confidence: 0.95
}
Validation: Check response addresses question
```

#### VERIFICATION Task Contract

```
Input:  "Verify auth module works"
Output: {
  findings: ["Auth routes present", "JWT validation found"],
  issues: [],
  isValid: true
}
Validation: Check findings are accurate, not just file presence
```

#### TESTING Task Contract

```
Input:  "Run unit tests"
Output: {
  testsRun: 15,
  testsPassed: 14,
  testsFailed: 1,
  coverage: 87.5,
  status: "partial_pass"
}
Validation: Check test results, not files
```

#### RESEARCH Task Contract

```
Input:  "Find best auth library"
Output: {
  candidates: ["passport", "auth0", "next-auth"],
  recommendation: "passport (most flexible)",
  reasoning: "..."
}
Validation: Check recommendations are sound
```

---

## Part 5: Root Cause Analysis

### 5.1 System Design Assumption

```
ASSUMPTION: All tasks = Code Implementation Tasks
         ↓
    All validation = File checking
         ↓
    All output = File arrays + summary
         ↓
    All prompts = "Modify files" instructions
         ↓
    CONSEQUENCE: Non-code tasks fail
```

### 5.2 Where System Should Diverge

```
IF task.intent == "code":
  USE: File-centric prompt + file validation
  OUTPUT: {files_created, files_updated, changes}
  
ELSE IF task.intent == "conversational":
  USE: Response-centric prompt + semantic validation
  OUTPUT: {response, isDirectAnswer, confidence}
  
ELSE IF task.intent == "verification":
  USE: Analysis-centric prompt + finding validation
  OUTPUT: {findings, issues, isValid}
  
... (etc for each type)
```

### 5.3 Why This Wasn't Done

1. **Scope Creep Avoidance**: System started as code-only, expanded organically
2. **Single Schema Assumption**: "One schema fits all tasks"
3. **Validation Simplicity**: File-based validation is easiest to automate
4. **Role Confusion**: System didn't distinguish "who is executing" (coder vs analyst vs reviewer)

---

## Part 6: Proposed Solution Architecture

### 6.1 Task Classification Layer (NEW)

```typescript
interface TaskMetadata {
  task_id: string;
  type: "code" | "conversational" | "verification" | "testing" | "research" | "analysis" | "review" | "planning";
  role: "coder" | "analyst" | "reviewer" | "researcher" | "tester";
  intent: string;
  description: string;
  acceptance_criteria: string[];
}

// Route based on type
if (task.type === "code") → useCodePipeline()
if (task.type === "conversational") → useConversationalPipeline()
if (task.type === "verification") → useVerificationPipeline()
... (etc)
```

### 6.2 Type-Specific Prompt Templates

#### CODE Task Prompt (CURRENT, NO CHANGE)
```
[Code-centric rules]
"Do NOT paraphrase... ONLY files..."
[Output: files_created, files_updated, changes]
```

#### CONVERSATIONAL Task Prompt (NEW)
```
You are a Conversational Agent.
Your role: Answer the user's question directly and clearly.

Task: {task_description}
Acceptance Criteria: {criteria}

Rules:
- Provide a direct, clear answer
- If unsure, acknowledge and explain uncertainty
- Keep response concise but complete

Output (JSON ONLY):
{
  "response": "Your answer here",
  "isDirectAnswer": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "Why you answered this way"
}
```

#### VERIFICATION Task Prompt (NEW)
```
You are a Verification Agent.
Your role: Check if acceptance criteria are met in the codebase.

Task: {task_description}
Acceptance Criteria: {criteria}

Rules:
- Read actual files, don't assume
- For each criterion, verify with grep/cat commands
- List specific findings with file paths
- Mark criterion as PASS, FAIL, or UNCLEAR

Output (JSON ONLY):
{
  "findings": [
    "Criterion 1: PASS - auth/middleware.ts exists with JWT validation"
  ],
  "issues": [
    "Criterion 2: FAIL - /api/health endpoint not found"
  ],
  "isValid": boolean,
  "recommendedActions": ["..."]
}
```

#### TESTING Task Prompt (NEW)
```
You are a Testing Agent.
Your role: Run tests and report results.

Task: {task_description}
Acceptance Criteria: {criteria}

Output (JSON ONLY):
{
  "testsRun": number,
  "testsPassed": number,
  "testsFailed": number,
  "coverage": number,
  "failedTests": ["test-name"],
  "status": "pass|fail|partial_pass"
}
```

### 6.3 Type-Specific Validation Schemas

#### CODE Task Output Schema
```typescript
interface CodeTaskOutput {
  status: "completed" | "failed";
  files_created: string[];
  files_updated: string[];
  changes: string[];
  neededChanges: boolean;
  summary: string;
}

// Validation: At least one file exists
Validator: files_created.length > 0 OR files_updated.length > 0
```

#### CONVERSATIONAL Task Output Schema
```typescript
interface ConversationalTaskOutput {
  status: "completed" | "failed";
  response: string;
  isDirectAnswer: boolean;
  confidence: number;  // 0.0-1.0
  reasoning: string;
}

// Validation: Response is non-empty and relevant
Validator: response.length > 0 AND confidence > 0.5
```

#### VERIFICATION Task Output Schema
```typescript
interface VerificationTaskOutput {
  status: "completed" | "failed";
  findings: string[];          // What was verified
  issues: string[];            // What failed
  isValid: boolean;            // All criteria met?
  recommendedActions: string[];
}

// Validation: Each finding references a file and criterion
Validator: findings.every(f => hasFileRef(f)) AND 
           (isValid ? issues.length === 0 : issues.length > 0)
```

#### TESTING Task Output Schema
```typescript
interface TestingTaskOutput {
  status: "completed" | "failed";
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  coverage?: number;           // Optional: % coverage
  failedTests?: string[];      // List of failed test names
}

// Validation: Numbers add up, status reflects results
Validator: testsPassed + testsFailed === testsRun AND
           (testsFailed === 0 ? status === "completed" : status !== "completed")
```

### 6.4 Role-Specific Instruction Sets

```typescript
interface RoleInstructions {
  role: "coder" | "analyst" | "reviewer" | "researcher";
  prompt_preamble: string;
  constraints: string[];
  output_schema: object;
  validation_rules: Function[];
}

const ROLES = {
  "coder": {
    preamble: "You are a Code Agent. Your task is to implement...",
    constraints: ["ONLY modify files in sandbox", "Reference real files"],
    output_schema: CodeTaskOutput,
  },
  "analyst": {
    preamble: "You are an Analysis Agent. Your task is to understand and report...",
    constraints: ["Read code files", "Provide findings with evidence"],
    output_schema: AnalysisTaskOutput,
  },
  "reviewer": {
    preamble: "You are a Review Agent. Your task is to review and approve...",
    constraints: ["Check against acceptance criteria", "List issues"],
    output_schema: ReviewTaskOutput,
  },
};
```

---

## Part 7: Implementation Roadmap

### Phase 1: Task Classification

**Goal**: Add task type detection and route accordingly.

**Tasks**:
1. Add `type` and `role` fields to TaskMetadata
2. Create `taskClassifier.ts`:
   - Infer type from intent/description (ML or rule-based)
   - Validate type/role compatibility
3. Create pipeline router:
   ```typescript
   dispatchTask(task) {
     const pipeline = getPipelineForType(task.type);
     return pipeline.execute(task);
   }
   ```

**Timeline**:  
**Files**: `taskMetadata.ts`, `taskClassifier.ts`, `pipelineRouter.ts`

---

### Phase 2: Prompt Templates by Type

**Goal**: Create distinct prompts for each task type.

**Tasks**:
1. Create prompt factory:
   ```typescript
   class PromptFactory {
     getPrompt(taskType: string): string { ... }
   }
   ```
2. Implement prompts for:
   - CODE (already exists, refactor)
   - CONVERSATIONAL (new)
   - VERIFICATION (new)
   - TESTING (new)
   - RESEARCH (new)
3. Add role-specific preambles and constraints

**Timeline**:  
**Files**: `promptFactory.ts`, `prompts/code.ts`, `prompts/conversational.ts`, etc.

---

### Phase 3: Output Schema & Validation by Type

**Goal**: Validate output per task type, not generic.

**Tasks**:
1. Create output schema registry:
   ```typescript
   const OUTPUT_SCHEMAS = {
     "code": CodeTaskOutput,
     "conversational": ConversationalTaskOutput,
     "verification": VerificationTaskOutput,
   };
   ```
2. Create per-type validators:
   ```typescript
   validateOutput(output, taskType): {isValid, errors}
   ```
3. Update supervisor validation logic:
   ```typescript
   // OLD: Check only files
   // NEW: Check based on task type
   if (task.type === "code") validateFiles(output);
   if (task.type === "conversational") validateResponse(output);
   if (task.type === "verification") validateFindings(output);
   ```

**Timeline**:  
**Files**: `outputSchemas.ts`, `validators/index.ts`, `validators/codeValidator.ts`, etc.

---

### Phase 4: Testing & Documentation)

**Goal**: Test all task types, document for operators.

**Tasks**:
1. Unit tests per task type
2. Integration tests (task classification → prompt → validation)
3. Test conversational, verification, testing tasks
4. Documentation: "How to use each task type"

**Timeline**:  
**Files**: `*.test.ts`, `docs/task-types.md`

---

## Part 8: Detailed Recommendations

### Recommendation 1: Immediate (Critical)

**Problem**: Greeting task fails because system expects files.  
**Fix**: 
- Add task type classification
- Create separate validation for conversational tasks
- Conversational success = meaningful response, not files

**Effort**: High (requires schema changes)  
**Impact**: Unblocks greeting + similar tasks

### Recommendation 2: Short-term

**Implement task type-specific prompts**:
- CODE: Use current prompt (file-centric, "do not speculate")
- CONVERSATIONAL: New prompt (response-centric, "answer directly")
- VERIFICATION: New prompt (analysis-centric, "check actual files")

**Effort**: Medium (3-4 new prompts)  
**Impact**: Unlocks 6+ task types

### Recommendation 3: Medium-term

**Add role assignments to tasks**:
- "coder" → Code pipeline
- "analyst" → Verification pipeline
- "reviewer" → Review pipeline

**Effort**: Medium (role metadata + dispatcher)  
**Impact**: Clarifies agent responsibility

### Recommendation 4: Validation Adjustment

**OLD** (code-centric):
```
success = files_created.length > 0 OR files_updated.length > 0
```

**NEW** (type-aware):
```
if (task.type === "code") 
  success = files_created.length > 0 OR files_updated.length > 0
else if (task.type === "conversational")
  success = response.length > 0 AND confidence > 0.5
else if (task.type === "verification")
  success = isValid === true
else ...
```

---

## Part 9: Why Phi-4-Mini "Failed" (Corrected)

### Previous Understanding (Incomplete)
"Phi-4-mini lacked creative overhead to handle conversational tasks."

### Corrected Understanding (Complete)
**Phi-4-mini didn't fail due to capability.** It failed because:

1. **System architectural bias**: Prompt assumes all tasks are code tasks
2. **Instruction conflict**: Rules say "only from context" + "don't speculate" = impossible for greeting task
3. **Schema mismatch**: Output schema expects files, but greeting produces response
4. **Validation mismatch**: Validator checks for files, not response quality

**If we gave Phi-4-mini a conversational prompt with response schema**, it would succeed:
```
# Conversational Prompt
"You are a helpful assistant. Answer the question: {task}"

# Response Schema
{"response": "...", "confidence": 0.95}

# Validation
response.length > 10
```

**Result**: ✅ Phi-4-mini would provide a greeting.

**Conclusion**: The model isn't the problem. The system architecture is.

---

## Part 10: System Capability Matrix (Before vs After)

| Task Type | BEFORE | AFTER |
|-----------|--------|-------|
| CODE (implement) | ✅ Works | ✅✅ Better |
| CONVERSATIONAL | ❌ Fails | ✅ Works |
| VERIFICATION | ❌ Fails | ✅ Works |
| TESTING | ❌ Fails | ✅ Works |
| RESEARCH | ❌ Fails | ✅ Works |
| ANALYSIS | ❌ Fails | ✅ Works |
| REVIEW | ❌ Fails | ✅ Works |
| PLANNING | ⚠️ Partial | ✅ Works |

---

## Conclusion

### Root Issues

1. **Single monolithic prompt** treating all tasks as code tasks
2. **Single output schema** (files_created, files_updated, changes)
3. **No task type classification** → no routing
4. **No role assignment** → implicit "coder" role for all
5. **Validation blindness** → checks structure, not semantics

### Solution Approach

**Add a task type layer**:
```
Task → Type Classification → Type-Specific Pipeline → Type-Specific Prompt → Type-Specific Schema → Type-Specific Validation
```

### Impact

- ✅ Unblocks 6+ task types (conversational, verification, testing, research, etc.)
- ✅ Keeps code task performance (already works)
- ✅ Improves semantic validation (checks meaning, not just files)
- ✅ Makes system extensible (easy to add new task types)

### Priority

**CRITICAL**: Implement task classification + conversational prompt  
**HIGH**: Implement verification + testing prompts  
**MEDIUM**: Role assignment + advanced validation

---

**Status**: Design Ready for Implementation  
**Blocking**: Multiple task types (greeting, verification, testing, etc.)  
**Unblocks**: Real-world agent workflows beyond code generation
