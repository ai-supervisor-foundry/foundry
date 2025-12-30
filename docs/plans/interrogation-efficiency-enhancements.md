# Interrogation Efficiency Enhancements

## Problem
Current interrogation involves a two-step LLM process:
1. Ask Agent "Where is this implemented?" (Prompt -> Agent Response)
2. Ask Analyst Agent "Did the agent answer correctly?" (Prompt + Agent Response -> Analyst Response)

This is inefficient in tokens and latency.

## Proposed Solution: Deterministic Validation Protocol

### 1. Structured Output Enforcement
Change the interrogation prompt to strictly require a JSON response.

```typescript
interface InterrogationResponse {
  results: {
    [criterion: string]: {
      status: "COMPLETE" | "INCOMPLETE" | "NOT_STARTED";
      file_paths: string[];
      evidence_snippet?: string; // Optional: quoted code to prove it
    }
  }
}
```

### 2. Local Validation (No LLM)
Instead of `analyzeBatchedResponse`, we use a code-based validator:
- Parse the JSON.
- For each `file_paths`:
  - Check `fs.existsSync()`.
  - (Optional) Read file and check if `evidence_snippet` (if provided) exists in content.
- Result determined by code:
  - If files exist: MARK COMPLETE.
  - If files missing: MARK INCOMPLETE (with reason: "File not found").

### 3. Feedback Loop
If Local Validation fails (e.g. file doesn't exist), the next interrogation round specifically targets the error:
"You claimed 'criterion A' was in 'src/A.ts', but that file does not exist. Please provide the correct path."

## Benefits
- **50% Reduction in LLM Calls**: Removes the analysis step completely.
- **Faster Feedback**: No waiting for analysis generation.
- **Higher Precision**: Code doesn't hallucinate file existence.
