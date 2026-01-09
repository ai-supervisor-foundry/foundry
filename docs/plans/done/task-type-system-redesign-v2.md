# Task Type System Redesign V2 (Enhanced)

**Status:** Proposed  
**Priority:** Critical  
**Goal:** Enable Supervisor to handle non-coding tasks (Conversational, Verification, Research) by decoupling the prompt/validation logic from the "Code Modification" paradigm.

---

## 1. Problem Statement

The Supervisor system currently assumes **all** tasks are "Code Implementation" tasks. It forces every task into a single prompt template and validation schema that demands file changes:
- `files_created: []`
- `files_updated: []`
- `changes: []`

**Impact:**
- **Conversational Tasks** (e.g., "Hello, who are you?") fail because the prompt rules ("Reference only files", "code changes + JSON only") force the model to ignore the conversational intent and output an empty file-change JSON.
- **Verification/Research Tasks** fail because they require analysis output, not file changes.

**Root Cause:**
`src/domain/agents/promptBuilder.ts` detects task types (`detectTaskType`) but **does not use this classification** to alter the `RULES_BLOCK` or the `Output Requirements` section. The system uses a monolithic prompt structure.

---

## 2. Solution Architecture

We will move from a Monolithic Prompt/Validator to a **Strategy Pattern** based on `TaskType`.

### 2.1 Task Type Definitions (Schema)

Update `src/domain/types/types.ts` to ensure `TaskType` is the source of truth.

```typescript
export type TaskType = 
  | 'coding'           // Standard file modification
  | 'behavioral'       // Conversational / Greeting (Response-centric)
  | 'verification'     // Code analysis / auditing (Findings-centric)
  | 'research'         // External info / library selection (Knowledge-centric)
  | 'testing'          // Running tests (Results-centric)
  | 'orchestration';   // Future: Delegating to other agents
```

### 2.2 Strategy Pattern Components

For each `TaskType`, we define a **Strategy** that provides:
1.  **Prompt Template:** Custom Rules, Guidelines, and Output Format.
2.  **Output Schema:** The expected JSON structure.
3.  **Validation Logic:** How to determine success.

#### Strategy Interface (Conceptual)

```typescript
interface TaskStrategy {
  type: TaskType;
  buildPrompt(task: Task, context: MinimalState): string;
  validate(output: any): ValidationReport;
}
```

---

## 3. Implementation Details

### 3.1 PromptBuilder Refactoring

We will replace the hardcoded `RULES_BLOCK` and `Output Requirements` with dynamic blocks based on `TaskType`.

#### A. Conversational / Behavioral Strategy
**Goal:** Allow the model to answer naturally without file constraints.

*   **Rules:**
    *   "Answer the user's question directly."
    *   "Do NOT invent file paths."
    *   "Provide a 'reasoning' field to explain your answer."
*   **Output Schema:**
    ```json
    {
      "status": "completed" | "failed",
      "response": "The actual text response to the user",
      "confidence": 0.0-1.0,
      "reasoning": "Chain-of-thought explanation"
    }
    ```

#### B. Verification Strategy
**Goal:** Allow the model to report findings without modifying code.

*   **Rules:**
    *   "Read files using `cat` or `grep`."
    *   "Report findings in the 'analysis' field."
    *   "Do NOT modify any files."
*   **Output Schema:**
    ```json
    {
      "status": "completed" | "failed",
      "findings": ["Finding 1", "Finding 2"],
      "verdict": "pass" | "fail",
      "reasoning": "Evidence-based conclusion"
    }
    ```

#### C. Coding Strategy (Existing)
*   **Rules:** Existing file-modification rules.
*   **Output Schema:** Existing `files_created`, `changes`, etc.

### 3.2 Dynamic Prompt Construction

Refactor `buildPrompt` in `promptBuilder.ts`:

```typescript
export function buildPrompt(task: Task, minimalState: MinimalState): string {
  const taskType = detectTaskType(task); // Or use task.task_type if set explicitely
  
  const sections = [];
  // ... Header sections ...

  // Dynamic Rules & Output
  if (taskType === 'behavioral') {
    sections.push(...BEHAVIORAL_RULES);
    sections.push(BEHAVIORAL_OUTPUT_SCHEMA);
  } else if (taskType === 'verification') {
    sections.push(...VERIFICATION_RULES);
    sections.push(VERIFICATION_OUTPUT_SCHEMA);
  } else {
    // Default to Coding
    sections.push(...CODING_RULES);
    sections.push(CODING_OUTPUT_SCHEMA);
  }
  
  // ... Context ...
  return sections.join('\n');
}
```

### 3.3 Validator Refactoring

Refactor `validateTaskOutput` in `src/application/services/validator.ts` (or create `src/domain/validation/strategies/`) to delegate validation.

```typescript
export async function validateTaskOutput(task: Task, result: ProviderResult): Promise<ValidationReport> {
  const output = parseJSON(result.output);
  const type = task.task_type || detectTaskType(task);

  switch (type) {
    case 'behavioral':
      return validateBehavioral(output);
    case 'verification':
      return validateVerification(output);
    case 'coding':
    default:
      return validateCoding(output); // Existing logic
  }
}
```

---

## 4. Enhanced Features

### 4.1 "Reasoning" Field (Chain of Thought)
We will enforce a `reasoning` or `thought_process` field in **ALL** schemas.
- **Why:** Models like Phi-4 perform significantly better when they output reasoning before the final result.
- **Implementation:** Add `"reasoning": "Explain your logic here"` to every JSON schema.

### 4.2 Zod Integration (Optional but Recommended)
Use `zod` to define schemas and generate the JSON schema string for the prompt.
- **Benefit:** Guarantees that the TypeScript interface used by the Validator matches exactly what the Prompt told the agent to produce.

### 4.3 Default Agent Modes
Map Task Types to Agent Modes in `controlLoop.ts`:
- `behavioral` -> `fast` (or `chat`)
- `verification` -> `reasoning` (or `opus`/`pro`)
- `coding` -> `auto`

---

## 5. Execution Roadmap

1.  **Phase 1: Interfaces & Types**
    - Update `TaskType` in `types.ts`.
    - Define interfaces for `BehavioralOutput`, `VerificationOutput`.

2.  **Phase 2: PromptBuilder Logic**
    - Extract current coding rules into `CODING_STRATEGY`.
    - Create `BEHAVIORAL_STRATEGY` (Conversational).
    - Update `buildPrompt` to switch strategies.

3.  **Phase 3: Validator Logic**
    - Create `validateBehavioral` function.
    - Switch validation logic based on type.

4.  **Phase 4: Testing**
    - Test "Hello World" prompt with Phi-4-mini (should now pass).
    - Regression test existing coding tasks.

---

## 6. Success Metrics

- **Phi-4-mini Pass:** The model correctly outputs a JSON response with `"response": "Hello..."` for the greeting task.
- **No Regression:** Coding tasks continue to produce file changes.
- **Clean Logs:** No "Output Format Invalid" errors for valid conversational responses.
