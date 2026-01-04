# Prompt Tightening Plan

## Executive Summary
This plan optimizes prompt construction in `src/domain/agents/promptBuilder.ts` to reduce token usage by **30-40% per prompt** while improving determinism and eliminating hallucinations. Key changes: consolidate scattered rules into single block, enforce JSON-only responses, validate file paths against filesystem, minimize context to task-relevant data only.

**Expected Impact**:
- Token savings: 400-500 tokens per task (including prompt + response)
- Cost reduction: ~40% per task at scale
- Reduced hallucinations: 100% path validation, no fabricated file references
- Faster execution: Fewer retry cycles from ambiguous responses

---

## Goals
- Reduce prompt tokens while increasing determinism and reducing hallucination risk.
- Enforce JSON-only outputs and deterministic file references.
- Encourage early stop/clarification when required data is missing.
- Eliminate prose padding, redundant sections, and ambiguous language patterns.

## Scope
- Primary: prompt construction in src/domain/agents/promptBuilder.ts (all prompt variants: buildPrompt, buildFixPrompt, buildClarificationPrompt, buildGoalCompletionPrompt).
- Secondary: documentation alignment (no code changes elsewhere unless required by contracts).
- Out of scope: provider-specific prompt modifications, validation/interrogation logic changes.

## Proposed Changes

### 1) Consolidated Rules Block
**Current state**: Rules scattered across sections (Instructions, Output Requirements, Guidelines).
**Target**: Single "Rules" section immediately after acceptance criteria, before context.

**Exact wording to add**:
```markdown
## Rules
- Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT
- Do NOT paraphrase, infer, or speculate beyond what is explicitly stated
- If critical details (file paths, API signatures, variable names) are missing, STOP and ask ONE clarifying question
- Remain in {AGENT_MODE} MODE throughout execution
- Reference only files that exist in sandbox_root; verify before mentioning
- Keep responses minimal: code changes + final JSON block only
- Do NOT explain what you're about to do; just do it
```

**Current sections to merge/remove**:
- Lines 213-216: "Remain in X MODE" instruction → moves to Rules
- Lines 220: "Halt on ambiguity" → moves to Rules as "STOP and ask"
- Lines 247: "Do not assume" → absorbed into "Do NOT infer"

**Token savings**: ~80-120 tokens per prompt (eliminates 3-4 redundant instruction lines).

**Example before**:
```
## Instructions
- Remain in AUTO MODE

- Halt on ambiguity - do not infer missing information

## Output Requirements
...

- Working directory: /path/to/sandbox

If any implementation decision is not explicitly specified above or in the refresher, STOP and ask for operator clarification. Do not assume.
```

**Example after**:
```
## Rules
- Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT
- Do NOT paraphrase, infer, or speculate beyond what is explicitly stated
- If critical details are missing, STOP and ask ONE clarifying question
- Remain in AUTO MODE throughout execution
- Keep responses minimal: code changes + final JSON block only

## Output Requirements
...
- Working directory: /path/to/sandbox
```

---

### 2) Stricter Output Contract
**Current state**: Lines 223-237 show JSON schema but allow prose before/after the JSON block.
**Target**: Mandate JSON-only final response with explicit array handling.

**Exact wording to replace** (lines 223-237):
```markdown
## Output Requirements
Your response MUST end with ONLY this JSON block. Do NOT include any prose, explanations, or conversational text before or after the JSON.

If you made no file changes, use empty arrays: `"files_created": [], "files_updated": [], "changes": []`
If you are unsure or cannot complete the task, set `"status": "failed"` and explain briefly in summary.

```json
{
  "status": "completed" | "failed",
  "files_created": ["relative/path/from/sandbox_root"],
  "files_updated": ["relative/path/from/sandbox_root"],
  "changes": ["relative/path/from/sandbox_root"],
  "neededChanges": true | false,
  "summary": "One sentence describing what was done or why it failed"
}
```

Do not add any other fields. Use the exact keys provided. All file paths must be relative to sandbox_root.
```

**Key changes**:
- Explicit "ONLY this JSON block" instruction
- Mandate empty arrays instead of omitting fields
- Require status="failed" for uncertainty (no fabricated success)
- All paths relative to sandbox_root (prevents absolute path hallucinations)
- One-sentence summary (prevents verbose explanations)

**Token savings**: Negligible on prompt size, but reduces response tokens by 100-300 per task (eliminates "Let me implement this..." preambles and "I've completed..." postambles).

**Example hallucination case prevented**:
```json
// BEFORE (hallucinated paths):
{
  "status": "completed",
  "files_created": ["/usr/local/src/config.ts", "~/project/utils.ts"],
  "summary": "I've successfully implemented the authentication system with JWT tokens and created the necessary middleware. The system now supports login, logout, and token refresh. Let me know if you need any adjustments!"
}

// AFTER (deterministic):
{
  "status": "completed",
  "files_created": ["src/auth/middleware.ts"],
  "files_updated": ["src/server.ts"],
  "changes": ["src/auth/middleware.ts", "src/server.ts"],
  "neededChanges": true,
  "summary": "Added JWT authentication middleware and integrated into server."
}
```

---

### 3) Deterministic Evidence - File Path Validation
**Current state**: No validation of file paths in agent responses; paths can be hallucinated.
**Target**: Add post-processing validation layer after parsing agent response.

**Implementation location**: New function in `src/domain/agents/promptBuilder.ts` or in `controlLoop.ts` after parsing.

**Exact function to add**:
```typescript
/**
 * Validate and filter file paths to only include files that exist in sandbox
 * Prevents hallucinated or absolute path references
 */
export function validateFilePaths(
  paths: string[],
  sandboxRoot: string
): string[] {
  const fs = require('fs');
  const path = require('path');
  
  return paths.filter(filePath => {
    // Remove absolute paths
    if (path.isAbsolute(filePath)) {
      logVerbose('ValidateFilePaths', 'Filtered absolute path', { filePath });
      return false;
    }
    
    // Remove paths starting with ~ or containing ../../../ (traversal attempts)
    if (filePath.startsWith('~') || filePath.includes('../')) {
      logVerbose('ValidateFilePaths', 'Filtered suspicious path', { filePath });
      return false;
    }
    
    // Check if file exists in sandbox
    const fullPath = path.join(sandboxRoot, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (!exists) {
      logVerbose('ValidateFilePaths', 'Filtered non-existent path', { filePath });
    }
    
    return exists;
  });
}
```

**Integration point** (in controlLoop.ts after parsing providerResult):
```typescript
// After line ~650 where providerResult is parsed:
if (providerResult.files_created) {
  providerResult.files_created = validateFilePaths(
    providerResult.files_created,
    sandboxCwd
  );
}
if (providerResult.files_updated) {
  providerResult.files_updated = validateFilePaths(
    providerResult.files_updated,
    sandboxCwd
  );
}
if (providerResult.changes) {
  providerResult.changes = validateFilePaths(
    providerResult.changes,
    sandboxCwd
  );
}
```

**Benefits**:
- Eliminates hallucinated file paths from validation/interrogation pipeline
- Prevents path traversal attempts (security)
- Provides clean logs of filtered paths for debugging
- No false positives in "files created" claims

---

### 4) Early-Stop on Missing Details
**Current state**: Line 247 says "STOP and ask" but doesn't give examples of what qualifies as missing detail.
**Target**: Explicit trigger conditions with examples in the prompt.

**Exact wording to add** (in Rules section):
```markdown
## Rules
...
- If critical details are missing, STOP and ask ONE clarifying question. Critical details include:
  * Specific file paths when task mentions "the config file" without naming it
  * API endpoint URLs when task says "call the API" without specifying which endpoint
  * Function/variable names when task says "update the handler" without naming it
  * Data structure shapes when task requires "parse the response" without showing example data
  
  Example early-stop responses:
  ```json
  {
    "status": "failed",
    "files_created": [],
    "files_updated": [],
    "changes": [],
    "neededChanges": false,
    "summary": "Cannot proceed: which config file should be updated (vite.config.ts, tsconfig.json, or .env)?"
  }
  ```
```

**Anti-pattern examples to include**:
```markdown
DO NOT do this (inferring missing details):
- Task says "update the config" → Agent assumes vite.config.ts
- Task says "call the API" → Agent invents /api/v1/users endpoint
- Task says "use the auth token" → Agent assumes localStorage.getItem('token')

DO this instead (ask for specifics):
- Task says "update the config" → Ask "Which config file: vite.config.ts, tsconfig.json, or .env?"
- Task says "call the API" → Ask "Which endpoint should be called?"
- Task says "use the auth token" → Ask "Where is the auth token stored?"
```

**Token impact**: +150 tokens to prompt, but prevents 1-3 retry cycles (~50k tokens saved per ambiguous task).

---

### 5) Task-Type Guidelines Slimming
**Current state**: Lines 122-157 show verbose multi-line guidelines per task type.
**Target**: Single-line imperatives with shared constraints factored out.

**Exact replacement** for `addTaskTypeGuidelines` function:
```typescript
function addTaskTypeGuidelines(sections: string[], taskType: TaskType): void {
  // Shared constraints (appear once, not per-type)
  const sharedConstraints = [
    '- Ensure all exports are typed correctly',
    '- Do not introduce breaking changes to public APIs',
    '- No conversational filler; code + JSON only'
  ];
  
  sections.push('## Guidelines');
  
  switch (taskType) {
    case 'implementation':
      sections.push('- Focus on clean code structure and established patterns');
      break;
    case 'configuration':
      sections.push('- Verify file locations and provide fallback values');
      break;
    case 'testing':
      sections.push('- Cover edge cases with descriptive assertions');
      break;
    case 'documentation':
      sections.push('- Use clear formatting and validate all links');
      break;
    case 'refactoring':
      sections.push('- Preserve functionality while improving structure');
      break;
    case 'behavioral':
      sections.push('- Provide clear conversational response addressing all parts');
      break;
  }
  
  // Add shared constraints only for code-modifying task types
  if (['implementation', 'refactoring', 'testing'].includes(taskType)) {
    sharedConstraints.forEach(constraint => sections.push(constraint));
  }
  
  sections.push('');
}
```

**Token savings**: ~60-90 tokens per prompt (eliminates repeated "Ensure all new components/functions are exported and typed correctly" across multiple types).

**Before** (implementation task):
```
## Guidelines
- Focus on clean code structure and established patterns.
- Ensure all new components/functions are exported and typed correctly.
- Be concise. If JSON output is requested, provide ONLY the JSON without conversational filler.
```

**After** (implementation task):
```
## Guidelines
- Focus on clean code structure and established patterns
- Ensure all exports are typed correctly
- Do not introduce breaking changes to public APIs
- No conversational filler; code + JSON only
```

---

### 6) Fix/Clarification Prompts Tightening
**Current state**: buildFixPrompt (lines 260-340) and buildClarificationPrompt (lines 350-420) include verbose "Original Task Description" and "Acceptance Criteria (reminder)" sections.
**Target**: Remove redundancy; agent already knows the task from initial prompt.

**Changes for buildFixPrompt**:
```typescript
// REMOVE these sections (lines ~303-313):
// Section 4: Original task description
// Section 5: Acceptance criteria (reminder)

// REPLACE with single line in Instructions:
sections.push('## Instructions');
sections.push('- Fix ONLY the issues in Validation Results; do not re-implement the entire task');
sections.push('- Apply fixes directly with given data; do not ask questions or re-explain');
sections.push('- Ensure ALL acceptance criteria are met');
sections.push(`- Remain in ${agentMode.toUpperCase()} MODE`);
sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
```

**Changes for buildClarificationPrompt**:
```typescript
// REMOVE these sections (lines ~373-383):
// Section 3: Original task description
// Section 4: Acceptance criteria (reminder)

// REPLACE with augmented Section 2:
sections.push('## Clarification Required');
if (haltReason === 'AMBIGUITY') {
  sections.push('Previous response used ambiguous language (maybe, could, suggest, recommend, option).');
  sections.push('Provide definitive implementation using only declarative statements.');
} else {
  sections.push('Previous response asked a question.');
  sections.push('Implement directly using only the information provided in the original task.');
}
sections.push('');

// Then go straight to Instructions (skip redundant sections)
sections.push('## Instructions');
sections.push('- Implement definitively without ambiguous terms or questions');
sections.push('- Use exact words: "will", "does", "creates", not "could", "might", "suggests"');
sections.push(`- Remain in ${agentMode.toUpperCase()} MODE`);
sections.push(`- Working directory: ${minimalState.project.sandbox_root}`);
```

**Token savings**: ~200-300 tokens per fix/clarification prompt (eliminates repeated task description and criteria).

**Rationale**: Agent context window retains the original task; repeating it verbatim wastes tokens and risks confusion about what changed.

---

### 7) Context Minimization - Enhanced Selectivity
**Current state**: buildMinimalState (lines 32-91) conditionally includes goal, queue, completed_tasks, blocked_tasks.
**Target**: Extend selectivity to more fields and add debug logging.

**Enhanced logic**:
```typescript
export function buildMinimalState(task: Task, state: SupervisorState, sandboxCwd: string): MinimalState {
  const context: MinimalState = {
    project: {
      id: state.goal.project_id || 'default',
      sandbox_root: sandboxCwd,
    },
  };

  const instructionsLower = task.instructions.toLowerCase();
  const intentLower = task.intent.toLowerCase();
  const criteriaText = task.acceptance_criteria.join(' ').toLowerCase();

  // Track what we're including for debugging
  const included: string[] = ['project'];

  // Include goal only if explicitly referenced
  if (
    instructionsLower.includes('goal') ||
    intentLower.includes('goal') ||
    criteriaText.includes('goal') ||
    task.task_id.startsWith('goal-')
  ) {
    context.goal = {
      id: state.goal.project_id || 'default',
      description: state.goal.description,
    };
    included.push('goal');
  }

  // Include queue info only if temporal references exist
  if (
    instructionsLower.includes('previous') ||
    instructionsLower.includes('last task') ||
    instructionsLower.includes('earlier') ||
    instructionsLower.includes('after') ||
    instructionsLower.includes('before')
  ) {
    context.queue = {
      last_task_id: state.supervisor.last_task_id,
    };
    included.push('queue');
  }

  // Include completed tasks only if building on previous work
  if (
    instructionsLower.includes('extend') ||
    instructionsLower.includes('build on') ||
    instructionsLower.includes('previous implementation') ||
    instructionsLower.includes('based on') ||
    intentLower.includes('extend')
  ) {
    context.completed_tasks = state.completed_tasks?.slice(-5).map(t => ({
      task_id: t.task_id,
      completed_at: t.completed_at,
    }));
    included.push(`completed_tasks(${context.completed_tasks?.length || 0})`);
  }

  // Include blocked tasks ONLY if task explicitly mentions unblocking
  if (
    instructionsLower.includes('unblock') ||
    instructionsLower.includes('blocked')
  ) {
    context.blocked_tasks = state.blocked_tasks?.map(t => ({
      task_id: t.task_id,
      reason: t.reason,
    }));
    included.push(`blocked_tasks(${context.blocked_tasks?.length || 0})`);
  }

  logVerbose('BuildMinimalState', 'Context built', {
    task_id: task.task_id,
    included_sections: included.join(', '),
    omitted_sections: ['goal', 'queue', 'completed_tasks', 'blocked_tasks']
      .filter(s => !included.includes(s) && !included.some(i => i.startsWith(s)))
      .join(', ') || 'none',
  });

  return context;
}
```

**Additional selectivity rules**:
- Never include `completed_tasks` if the task is marked as `standalone: true`
- Never include `blocked_tasks` unless the task intent is "unblock" or "fix dependencies"
- For documentation tasks, omit all state except `project` (docs don't depend on runtime state)
- For testing tasks, include only `project` and optionally `completed_tasks` if test depends on implementation

**Token savings**: 150-400 tokens per prompt depending on state size (e.g., if completed_tasks has 50 entries, omitting it saves ~350 tokens).

## Implementation Steps

### Phase 1: Rules Block Consolidation (1-2 hours)
**File**: src/domain/agents/promptBuilder.ts

1. Create new `buildRulesSection()` helper function:
   ```typescript
   function buildRulesSection(sections: string[], agentMode: string): void {
     sections.push('## Rules');
     sections.push('- Use ONLY information from Task Description, Acceptance Criteria, and READ-ONLY CONTEXT');
     sections.push('- Do NOT paraphrase, infer, or speculate beyond what is explicitly stated');
     sections.push('- If critical details (file paths, API signatures, variable names) are missing, STOP and ask ONE clarifying question');
     sections.push(`- Remain in ${agentMode.toUpperCase()} MODE throughout execution`);
     sections.push('- Reference only files that exist in sandbox_root; verify before mentioning');
     sections.push('- Keep responses minimal: code changes + final JSON block only');
     sections.push('- Do NOT explain what you\'re about to do; just do it');
     sections.push('');
   }
   ```

2. Update `buildPrompt()`:
   - Insert `buildRulesSection(sections, task.agent_mode || 'auto')` after acceptance criteria (after line ~206)
   - Remove lines 213-216 (agent mode instruction)
   - Remove line 220 (halt on ambiguity)
   - Remove line 247 (final "do not assume" instruction)

3. Update `buildFixPrompt()`:
   - Remove Section 4 (Original task description, lines ~303-307)
   - Remove Section 5 (Acceptance criteria reminder, lines ~310-315)
   - Add single line in Instructions: "Fix ONLY the issues in Validation Results; do not re-implement"

4. Update `buildClarificationPrompt()`:
   - Remove Section 3 (Original task description, lines ~373-377)
   - Remove Section 4 (Acceptance criteria reminder, lines ~380-385)
   - Enhance Section 2 with examples of ambiguous vs. definitive language

**Test**: Run `npm run test:prompt-builder` (if exists) or manually build 3 sample prompts and compare token counts.
**Success criteria**: Token count reduced by 80-150 per prompt; all sections still present; no semantic loss.

---

### Phase 2: Output Contract Enforcement (2-3 hours)
**Files**: src/domain/agents/promptBuilder.ts, src/application/services/controlLoop.ts

1. **In buildPrompt()** (lines 223-237):
   - Replace Output Requirements section with strict wording:
     ```typescript
     sections.push('## Output Requirements');
     sections.push('Your response MUST end with ONLY this JSON block. Do NOT include prose before or after.');
     sections.push('');
     sections.push('If you made no file changes, use empty arrays: `"files_created": [], "files_updated": [], "changes": []`');
     sections.push('If you are unsure or cannot complete, set `"status": "failed"` and explain briefly in summary.');
     sections.push('');
     sections.push('```json');
     sections.push('{');
     sections.push('  "status": "completed" | "failed",');
     sections.push('  "files_created": ["relative/path/from/sandbox_root"],');
     sections.push('  "files_updated": ["relative/path/from/sandbox_root"],');
     sections.push('  "changes": ["relative/path/from/sandbox_root"],');
     sections.push('  "neededChanges": true | false,');
     sections.push('  "summary": "One sentence describing what was done or why it failed"');
     sections.push('}');
     sections.push('```');
     sections.push('');
     sections.push('Do not add any other fields. Use the exact keys provided. All file paths must be relative to sandbox_root.');
     ```

2. **Create validateFilePaths() function** in promptBuilder.ts:
   ```typescript
   export function validateFilePaths(
     paths: string[],
     sandboxRoot: string
   ): string[] {
     const fs = require('fs');
     const path = require('path');
     
     return paths.filter(filePath => {
       if (path.isAbsolute(filePath)) {
         logVerbose('ValidateFilePaths', 'Filtered absolute path', { filePath });
         return false;
       }
       
       if (filePath.startsWith('~') || filePath.includes('../')) {
         logVerbose('ValidateFilePaths', 'Filtered suspicious path', { filePath });
         return false;
       }
       
       const fullPath = path.join(sandboxRoot, filePath);
       const exists = fs.existsSync(fullPath);
       
       if (!exists) {
         logVerbose('ValidateFilePaths', 'Filtered non-existent path', { filePath });
       }
       
       return exists;
     });
   }
   ```

3. **In controlLoop.ts** (after providerResult parsing, around line ~650):
   ```typescript
   // Validate file paths after parsing agent response
   if (providerResult.files_created) {
     const originalCount = providerResult.files_created.length;
     providerResult.files_created = validateFilePaths(providerResult.files_created, sandboxCwd);
     const filteredCount = originalCount - providerResult.files_created.length;
     if (filteredCount > 0) {
       logVerbose('ControlLoop', 'Filtered hallucinated paths from files_created', { 
         filtered_count: filteredCount,
         task_id: task.task_id 
       });
     }
   }
   
   // Repeat for files_updated and changes
   if (providerResult.files_updated) {
     providerResult.files_updated = validateFilePaths(providerResult.files_updated, sandboxCwd);
   }
   if (providerResult.changes) {
     providerResult.changes = validateFilePaths(providerResult.changes, sandboxCwd);
   }
   ```

**Test**: Run a task that typically produces verbose responses; verify JSON-only output and no hallucinated paths.
**Success criteria**: Agent responses contain only JSON block; no absolute or non-existent paths in arrays.

---

### Phase 3: Enhanced Context Selectivity (1 hour)
**File**: src/domain/agents/promptBuilder.ts (buildMinimalState function)

1. Extend keyword detection to include acceptance criteria:
   ```typescript
   const criteriaText = task.acceptance_criteria.join(' ').toLowerCase();
   ```

2. Add more temporal keywords for queue inclusion:
   ```typescript
   if (
     instructionsLower.includes('previous') ||
     instructionsLower.includes('last task') ||
     instructionsLower.includes('earlier') ||
     instructionsLower.includes('after') ||
     instructionsLower.includes('before')
   ) {
     context.queue = { last_task_id: state.supervisor.last_task_id };
     included.push('queue');
   }
   ```

3. Add debug logging at end of buildMinimalState:
   ```typescript
   logVerbose('BuildMinimalState', 'Context built', {
     task_id: task.task_id,
     included_sections: included.join(', '),
     omitted_sections: ['goal', 'queue', 'completed_tasks', 'blocked_tasks']
       .filter(s => !included.includes(s))
       .join(', ') || 'none',
   });
   ```

4. Add special case handling:
   ```typescript
   // Never include completed_tasks for documentation tasks
   if (taskType === 'documentation') {
     delete context.completed_tasks;
     delete context.queue;
   }
   ```

**Test**: Run 5 different task types; inspect logs to verify only relevant context sections are included.
**Success criteria**: Documentation tasks have minimal context; implementation tasks include relevant history; logs show omitted sections.

---

### Phase 4: Task-Type Guidelines Optimization (30 minutes)
**File**: src/domain/agents/promptBuilder.ts (addTaskTypeGuidelines function)

1. Extract shared constraints to top of function:
   ```typescript
   const sharedConstraints = [
     '- Ensure all exports are typed correctly',
     '- Do not introduce breaking changes to public APIs',
     '- No conversational filler; code + JSON only'
   ];
   ```

2. Simplify each case to single-line imperative:
   ```typescript
   case 'implementation':
     sections.push('- Focus on clean code structure and established patterns');
     break;
   case 'configuration':
     sections.push('- Verify file locations and provide fallback values');
     break;
   // ... etc
   ```

3. Conditionally append shared constraints:
   ```typescript
   if (['implementation', 'refactoring', 'testing'].includes(taskType)) {
     sharedConstraints.forEach(constraint => sections.push(constraint));
   }
   ```

**Test**: Generate prompts for all 6 task types; verify each has appropriate guidelines without repetition.
**Success criteria**: 60-90 tokens saved per prompt; guidelines remain clear and actionable.

---

### Phase 5: Sample Prompt Analysis & Token Counting (1 hour)

1. Create test script `scripts/analyze-prompt-tokens.ts`:
   ```typescript
   import { buildPrompt, buildMinimalState } from '../src/domain/agents/promptBuilder';
   import { Task, SupervisorState } from '../src/domain/types/types';
   
   // Sample task for each type
   const sampleTasks: Array<[string, Task]> = [
     ['implementation', { 
       task_id: 'impl-1', 
       instructions: 'Create a user authentication module',
       intent: 'Implement login/logout',
       acceptance_criteria: ['JWT tokens', 'Secure storage', 'Error handling'],
       agent_mode: 'auto'
     }],
     ['documentation', { 
       task_id: 'doc-1', 
       instructions: 'Write API documentation',
       intent: 'Document all endpoints',
       acceptance_criteria: ['All routes listed', 'Examples provided'],
       agent_mode: 'auto'
     }],
     // ... etc for all types
   ];
   
   // Mock state
   const state: SupervisorState = { /* ... */ };
   
   for (const [type, task] of sampleTasks) {
     const minimalState = buildMinimalState(task, state, '/sandbox/test');
     const prompt = buildPrompt(task, minimalState);
     
     console.log(`\n${type.toUpperCase()} Task:`);
     console.log(`  Prompt length: ${prompt.length} chars`);
     console.log(`  Estimated tokens: ${Math.ceil(prompt.length / 4)}`);
     console.log(`  Sections: ${prompt.split('\n## ').length - 1}`);
     console.log(`  Context included: ${Object.keys(minimalState).join(', ')}`);
   }
   ```

2. Run baseline analysis (before changes):
   ```bash
   npm run tsx scripts/analyze-prompt-tokens.ts > /tmp/baseline.txt
   ```

3. After implementing Phase 1-4, run again:
   ```bash
   npm run tsx scripts/analyze-prompt-tokens.ts > /tmp/optimized.txt
   ```

4. Compare results:
   ```bash
   diff -y /tmp/baseline.txt /tmp/optimized.txt
   ```

**Success criteria**: 
- Average token reduction: 30-40% per prompt
- Implementation tasks: ~1200 → ~800 tokens
- Documentation tasks: ~900 → ~600 tokens
- No loss of critical information

---

### Phase 6: Integration Testing (2 hours)

1. **Test Case 1**: Simple implementation task
   - Task: "Add a calculateTotal() function to utils.ts"
   - Expected: JSON-only response, no verbose explanation
   - Verify: files_updated contains only "src/utils.ts"

2. **Test Case 2**: Ambiguous task (early-stop test)
   - Task: "Update the config file with new settings"
   - Expected: status="failed", summary asks which config file
   - Verify: No files modified, single clarifying question

3. **Test Case 3**: Documentation task (context minimization)
   - Task: "Document the authentication flow"
   - Expected: Context contains only project info (no completed_tasks, queue, etc.)
   - Verify: Prompt < 700 tokens

4. **Test Case 4**: Fix prompt (redundancy removal)
   - Initial task fails validation
   - Fix prompt generated
   - Expected: No repetition of original task description
   - Verify: Fix prompt 40% shorter than original + validation report

5. **Test Case 5**: Hallucination prevention
   - Task that typically causes path hallucinations
   - Expected: validateFilePaths filters out non-existent paths
   - Verify: Logs show filtered paths; providerResult contains only real files

**Run command**:
```bash
# Start supervisor with sample tasks
npm run start:supervisor -- --test-mode --tasks scripts/test-tasks.json

# Monitor logs for token counts and response formats
tail -f logs/prompts.log.jsonl | jq '.prompt_length, .response_length'
```

**Success criteria**:
- All 5 test cases pass
- No regression in task success rate
- Average token savings: 30-40%
- No hallucinated file paths in any test
- Agent responses are JSON-only (no prose)

## Validation

### Manual Review Checklist
After implementing all phases, manually inspect 3-5 generated prompts:

**Structural checks**:
- [ ] Single Rules block appears after Acceptance Criteria
- [ ] No redundant "Remain in X MODE" scattered across sections
- [ ] Guidelines section is 3-5 lines max (not 8-10)
- [ ] Output Requirements explicitly says "ONLY this JSON block"
- [ ] No repeated task description in fix/clarification prompts

**Content checks**:
- [ ] Rules block contains 7 core imperatives (no speculation, STOP on missing data, etc.)
- [ ] JSON schema shows exact keys with examples
- [ ] File paths use "relative/path/from/sandbox_root" notation
- [ ] Early-stop examples included for ambiguous scenarios
- [ ] Working directory appears only once (in Output Requirements)

**Token efficiency checks**:
- [ ] Implementation task prompt: ~800 tokens (was ~1200)
- [ ] Documentation task prompt: ~600 tokens (was ~900)
- [ ] Fix prompt: 40% shorter than original prompt + validation report
- [ ] Context includes only 1-2 optional sections (not all 4)

**Determinism checks**:
- [ ] No phrases like "I'll implement", "Let me", "I've completed"
- [ ] Response parsing extracts only JSON block (strips any prose)
- [ ] validateFilePaths filters out 100% of non-existent paths
- [ ] Logs show which context sections were omitted

---

### Automated Testing

**Unit tests** (`tests/unit/promptBuilder.test.ts`):
```typescript
describe('buildPrompt', () => {
  it('should include Rules block after Acceptance Criteria', () => {
    const prompt = buildPrompt(sampleTask, minimalState);
    const rulesIndex = prompt.indexOf('## Rules');
    const criteriaIndex = prompt.indexOf('## Acceptance Criteria');
    expect(rulesIndex).toBeGreaterThan(criteriaIndex);
  });

  it('should not repeat agent mode instruction', () => {
    const prompt = buildPrompt(sampleTask, minimalState);
    const modeMatches = prompt.match(/Remain in .+ MODE/g);
    expect(modeMatches?.length).toBe(1); // Only in Rules block
  });

  it('should enforce JSON-only output', () => {
    const prompt = buildPrompt(sampleTask, minimalState);
    expect(prompt).toContain('ONLY this JSON block');
    expect(prompt).toContain('Do NOT include prose before or after');
  });
});

describe('buildMinimalState', () => {
  it('should omit goal when not referenced', () => {
    const task = { 
      instructions: 'Create utils.ts', 
      intent: 'Add utility functions',
      acceptance_criteria: ['Functions exported']
    };
    const state = buildMinimalState(task, fullState, '/sandbox');
    expect(state.goal).toBeUndefined();
  });

  it('should include goal when explicitly mentioned', () => {
    const task = { 
      instructions: 'Align implementation with project goal', 
      intent: 'Match goal requirements',
      acceptance_criteria: ['Goal criteria met']
    };
    const state = buildMinimalState(task, fullState, '/sandbox');
    expect(state.goal).toBeDefined();
  });
});

describe('validateFilePaths', () => {
  it('should filter absolute paths', () => {
    const paths = ['/usr/local/file.ts', 'src/utils.ts'];
    const validated = validateFilePaths(paths, '/sandbox');
    expect(validated).not.toContain('/usr/local/file.ts');
  });

  it('should filter non-existent files', () => {
    const paths = ['src/real.ts', 'src/fake.ts'];
    // Assuming only src/real.ts exists
    const validated = validateFilePaths(paths, '/sandbox');
    expect(validated).toContain('src/real.ts');
    expect(validated).not.toContain('src/fake.ts');
  });

  it('should filter path traversal attempts', () => {
    const paths = ['../../../etc/passwd', '~/secrets.txt'];
    const validated = validateFilePaths(paths, '/sandbox');
    expect(validated).toHaveLength(0);
  });
});
```

**Integration test** (`tests/integration/prompt-optimization.test.ts`):
```typescript
describe('End-to-end prompt optimization', () => {
  it('should reduce token count by 30-40% without losing semantics', async () => {
    const baselinePrompt = buildPromptOld(task, state, sandboxCwd); // Before optimization
    const optimizedPrompt = buildPrompt(task, minimalState); // After optimization
    
    const baselineTokens = estimateTokens(baselinePrompt);
    const optimizedTokens = estimateTokens(optimizedPrompt);
    const reduction = ((baselineTokens - optimizedTokens) / baselineTokens) * 100;
    
    expect(reduction).toBeGreaterThanOrEqual(30);
    expect(reduction).toBeLessThanOrEqual(45); // Sanity check
  });

  it('should produce JSON-only responses from agent', async () => {
    const task = createSampleTask();
    const response = await executeTask(task);
    
    // Response should be parseable JSON with no surrounding text
    const trimmed = response.trim();
    expect(trimmed.startsWith('{')).toBe(true);
    expect(trimmed.endsWith('}')).toBe(true);
    
    const parsed = JSON.parse(trimmed);
    expect(parsed.status).toBeDefined();
    expect(parsed.summary).toBeDefined();
  });

  it('should prevent hallucinated file paths', async () => {
    const task = createHallucinationProneTask();
    const result = await executeTask(task);
    
    // All returned paths should exist
    for (const path of result.files_created) {
      const fullPath = join(sandboxRoot, path);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });
});
```

**Run tests**:
```bash
npm run test -- --grep "promptBuilder|prompt-optimization"
```

**Success criteria**:
- All unit tests pass (15+ assertions)
- Integration tests show 30-40% token reduction
- Zero hallucinated paths in 10+ test runs
- Agent responses are valid JSON with no prose

---

### Regression Testing

**Before deploying to production**, run full task suite:

1. **Baseline collection** (using old prompt builder):
   ```bash
   # Checkout baseline commit
   git checkout main
   npm run supervisor -- --task-file tests/regression-tasks.json --output baseline-results.json
   ```

2. **Optimized collection** (using new prompt builder):
   ```bash
   # Checkout optimized branch
   git checkout feature/prompt-optimization
   npm run supervisor -- --task-file tests/regression-tasks.json --output optimized-results.json
   ```

3. **Compare results**:
   ```bash
   npm run compare-results baseline-results.json optimized-results.json
   ```

**Metrics to compare**:
- Task success rate: Must be ≥ baseline (no regression)
- Average tokens per task: Should be 30-40% lower
- Average execution time: Should be similar or faster
- Validation pass rate: Should be similar or higher
- Interrogation rounds: Should be lower (fewer ambiguous responses)

**Acceptable regression**:
- Success rate: -2% max (e.g., 95% → 93%)
- Execution time: +10% max (slight increase acceptable for better quality)

**Unacceptable regression**:
- Success rate: <90% (was 95%)
- Hallucination rate: >0% (any hallucinated paths)
- JSON parse failures: >0% (all responses must be valid JSON)

## Docs Impact

### Files requiring updates:

1. **docs/PROMPT.md** (if exists)
   - Add section on Rules block structure
   - Document JSON-only output requirement
   - Add examples of early-stop scenarios
   - Update token optimization guidelines

2. **docs/TOOL_CONTRACTS.md**
   - Update agent response schema to emphasize JSON-only format
   - Add validateFilePaths contract
   - Document path validation rules (relative only, must exist)

3. **docs/plans/validation-interrogation-optimization.md**
   - Add note in "Token Usage Breakdown" section referencing this optimization
   - Update "Current System" flow to reflect new prompt structure
   - Optional: Add "After Prompt Tightening" comparison showing 30-40% token reduction
   - No required changes, but synergy note recommended:
     ```markdown
     ## Synergies with Prompt Tightening
     
     The validation-interrogation pipeline operates on agent responses. With prompt tightening 
     (see prompt-tightening-plan.md), we achieve:
     - 30-40% fewer prompt tokens (less context to send)
     - JSON-only responses (easier parsing, no prose stripping needed)
     - Validated file paths (interrogation can trust file references)
     - Early-stop behavior (fewer retry cycles from ambiguous responses)
     
     Combined savings: ~60-75% token reduction per task (prompt + interrogation cycles).
     ```

4. **README.md** (project root)
   - Update "Prompt Engineering" section if present
   - Add bullet point: "Deterministic prompt construction with 30-40% token optimization"
   - Add bullet point: "JSON-only responses with path validation"

5. **docs/ARCHITECTURE.md** or **docs/ARCHITECTURE_DETAILED.md**
   - Update PromptBuilder component description
   - Add validateFilePaths as a new component in agent response processing
   - Update data flow diagram (if present) to show path validation step

### Optional documentation:

6. **Create docs/PROMPT_OPTIMIZATION_METRICS.md**:
   ```markdown
   # Prompt Optimization Metrics
   
   ## Baseline (before optimization)
   - Implementation task: ~1200 tokens
   - Documentation task: ~900 tokens
   - Fix prompt: original + validation report (~1500 tokens)
   - Average response: 400-600 tokens (includes prose)
   
   ## Optimized (after prompt tightening)
   - Implementation task: ~800 tokens (-33%)
   - Documentation task: ~600 tokens (-33%)
   - Fix prompt: ~900 tokens (-40%)
   - Average response: 150-250 tokens (JSON only, -60%)
   
   ## Per-task savings (full cycle)
   - Baseline: 1200 (prompt) + 500 (response) + 1500 (fix) + 500 (fix response) = 3700 tokens
   - Optimized: 800 + 200 + 900 + 200 = 2100 tokens
   - Savings: 43% per task requiring fix
   
   ## Annual cost impact (projected)
   - Baseline: 10k tasks × 2500 avg tokens × $0.015/1k = $375/year
   - Optimized: 10k tasks × 1500 avg tokens × $0.015/1k = $225/year
   - Savings: $150/year (40%)
   ```

### No changes needed:

- **docs/AMBIGUITY_HANDLING.md** - Already covers halt behavior; prompt just enforces it
- **docs/LOGGING.md** - Existing log structure handles new verbose logs for path validation
- **docs/STATE_*.md** files - No state schema changes
- **docs/SANDBOX.md** - Sandbox behavior unchanged
- **docs/RECOVERY.md** - Recovery logic unaffected

### Documentation review checklist:

After implementation, verify:
- [ ] All prompt examples in docs show JSON-only format
- [ ] No docs reference old multi-section instruction format
- [ ] Architecture diagrams include validateFilePaths step
- [ ] Token cost projections updated in any budget docs
- [ ] All references to "agent responses may include explanations" updated to "agent responses are JSON-only"

## Risks / Mitigations

### Risk 1: Agents break with JSON-only requirement
**Likelihood**: Medium  
**Impact**: High (all tasks fail)  
**Symptom**: Parsing errors in controlLoop.ts when extracting JSON from responses

**Mitigation**:
1. Keep existing JSON extraction logic as fallback:
   ```typescript
   // Try to extract JSON from response even if prose included
   const jsonMatch = response.match(/\{[\s\S]*\}/);
   if (jsonMatch) {
     return JSON.parse(jsonMatch[0]);
   }
   ```
2. Add logging when prose is detected:
   ```typescript
   if (response.trim() !== jsonMatch[0].trim()) {
     logVerbose('ControlLoop', 'Agent included prose despite JSON-only instruction', {
       task_id: task.task_id,
       response_length: response.length,
       json_length: jsonMatch[0].length
     });
   }
   ```
3. Gradual rollout: Test on 10% of tasks first, monitor parse failure rate
4. If parse failures >5%, add explicit "JSON-only" prefix to every response:
   ```typescript
   // In prompt: "Start your response with exactly: ```json"
   ```

**Rollback plan**: Revert Output Requirements section to allow prose; keep path validation.

---

### Risk 2: Over-selective context omits needed data
**Likelihood**: Medium  
**Impact**: Medium (tasks fail or ask unnecessary clarifying questions)  
**Symptom**: Agent asks "what is the project goal?" when goal was omitted but relevant

**Mitigation**:
1. Log all context omissions:
   ```typescript
   logVerbose('BuildMinimalState', 'Omitted sections', {
     task_id: task.task_id,
     omitted: ['goal', 'queue'].filter(s => !context[s]),
     task_keywords: [instructionsLower, intentLower].join(' ')
   });
   ```
2. Add escape hatch keyword "context:full" in task instructions:
   ```typescript
   if (task.instructions.includes('context:full')) {
     // Include all sections regardless of selectivity logic
     context.goal = { ... };
     context.queue = { ... };
     // etc
   }
   ```
3. Monitor clarifying question rate: if >10% of tasks ask for context info, expand selectivity keywords
4. Whitelist certain task types for full context (e.g., "goal-completion" always gets full state)

**Detection**: Grep logs for phrases like "what is the", "which file", "where is" in agent responses

**Rollback plan**: Disable selectivity by always including all 4 context sections; lose token savings but maintain functionality.

---

### Risk 3: validateFilePaths filters legitimate files
**Likelihood**: Low  
**Impact**: Medium (false negatives in file tracking)  
**Symptom**: Agent creates file, but it doesn't appear in files_created array

**Mitigation**:
1. Only filter paths that definitively don't exist at validation time:
   ```typescript
   const exists = fs.existsSync(fullPath);
   if (!exists) {
     // Check if file was just created (async race condition)
     await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
     const existsAfterDelay = fs.existsSync(fullPath);
     if (!existsAfterDelay) {
       logVerbose('ValidateFilePaths', 'Filtered non-existent path', { filePath });
       return false;
     }
   }
   return true;
   ```
2. Log all filtered paths with reason:
   ```typescript
   if (path.isAbsolute(filePath)) {
     logVerbose('ValidateFilePaths', 'Filtered absolute path', { filePath, task_id });
   }
   ```
3. Add metric: `filtered_paths_per_task` - if >2, investigate for overly aggressive filtering
4. Whitelist certain patterns if false positives detected:
   ```typescript
   // Allow node_modules references for package installs
   if (filePath.startsWith('node_modules/') && task.intent.includes('install')) {
     return true;
   }
   ```

**Detection**: Compare files_created count before/after validation; alert if >30% filtered

**Rollback plan**: Make validateFilePaths optional via config flag; default to enabled but allow disable.

---

### Risk 4: Rules block creates prompt rigidity
**Likelihood**: Low  
**Impact**: Low (agents over-halt, blocking on minor ambiguities)  
**Symptom**: Tasks fail with status="failed" and "need clarification" for things that could be reasonably inferred

**Mitigation**:
1. Tune "critical details" definition with examples:
   ```markdown
   Critical details include:
   - Specific file paths when multiple candidates exist (NOT when obvious: "index.ts" is clear)
   - API endpoint URLs (NOT when standard RESTful pattern applies)
   - Function signatures when integrating with existing code (NOT for new standalone functions)
   ```
2. Add "use reasonable defaults for minor details" clause:
   ```markdown
   - For minor details (variable names, formatting, default values), use industry standards
   - For critical details (file paths, API endpoints, data structures), STOP if ambiguous
   ```
3. Monitor halt rate: if >20% of tasks halt for clarification, relax rules wording
4. Add task-type exemptions:
   ```typescript
   // Behavioral tasks don't need strict halting
   if (taskType === 'behavioral') {
     return; // Skip Rules block
   }
   ```

**Detection**: Count tasks with status="failed" and summary containing question marks; if >20%, rules too strict

**Rollback plan**: Remove "STOP and ask" clause; keep other rules for determinism.

---

### Risk 5: Token savings don't materialize due to provider-specific formatting
**Likelihood**: Low  
**Impact**: Low (optimization effort wasted but no functionality loss)  
**Symptom**: Token counts similar before/after despite shorter prompts

**Mitigation**:
1. Measure tokens at provider API level (actual billed tokens), not character count:
   ```typescript
   import { encoding_for_model } from 'tiktoken';
   const encoder = encoding_for_model('gpt-4');
   const tokens = encoder.encode(prompt);
   logPerformance('PromptTokens', tokens.length, { task_id });
   ```
2. Test with multiple providers (e.g., Gemini, Copilot, Claude, GPT-4) to verify savings are universal
3. If token counting differs significantly, optimize for most-used provider
4. Document actual vs. estimated savings:
   ```markdown
   Estimated (character-based): 35% reduction
   Actual (GPT-4 tokens): 32% reduction
   Actual (Claude tokens): 38% reduction
   ```

**Detection**: Compare `logPerformance` token counts before/after optimization; if delta <20%, investigate

**Rollback plan**: None needed - shorter prompts never hurt even if token counting is imprecise.

---

### Risk 6: Breaking changes to PromptBuilder API
**Likelihood**: Low  
**Impact**: Medium (downstream code needs updates)  
**Symptom**: Compilation errors or unexpected behavior in code that calls buildPrompt()

**Mitigation**:
1. Maintain backward compatibility with legacy PromptBuilder class:
   ```typescript
   // Keep existing class interface intact
   export class PromptBuilder {
     buildTaskPrompt(task: Task, stateSnapshot: MinimalState): string {
       return buildPrompt(task, stateSnapshot); // Delegate to new function
     }
   }
   ```
2. Deprecation warning for old usage:
   ```typescript
   export class PromptBuilder {
     constructor() {
       console.warn('PromptBuilder class is deprecated. Use buildPrompt() function directly.');
     }
   }
   ```
3. Version the prompt format:
   ```typescript
   export const PROMPT_FORMAT_VERSION = '2.0';
   // Include in logs for debugging
   ```
4. Update all internal callers first before making breaking changes:
   ```bash
   git grep "new PromptBuilder" # Find all usages
   ```

**Detection**: Run full test suite; any import errors or signature mismatches indicate breaking change

**Rollback plan**: Keep both old and new prompt builders for one release cycle; remove old after migration complete.

---

## Risk Summary Matrix

| Risk | Likelihood | Impact | Priority | Mitigation Effort |
|------|-----------|--------|----------|-------------------|
| JSON-only breaks agents | Medium | High | P0 | Medium (fallback logic) |
| Over-selective context | Medium | Medium | P1 | Low (logging + escape hatch) |
| Path validation false positives | Low | Medium | P2 | Low (timing fix) |
| Rules too strict | Low | Low | P3 | Low (tuning examples) |
| Token savings don't materialize | Low | Low | P4 | Medium (proper token counting) |
| Breaking API changes | Low | Medium | P2 | Low (backward compat) |

**Overall risk level**: MEDIUM  
**Recommended approach**: Phased rollout with canary testing (10% → 50% → 100% of tasks)
