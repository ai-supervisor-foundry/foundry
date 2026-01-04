# Validation Checklist

- [ ] Was output generated for the specified task?
- [ ] Does output meet all acceptance criteria?
- [ ] Are test outputs present?
- [ ] Is state updated appropriately?
- [ ] Any ambiguity halts and requires operator clarification.

## Validation Rules

- Validation logic must be deterministic, rule-based, and non-AI.
- Examples: file exists, tests pass, diff matches criteria, artifact count matches expectation.
- If validation cannot be automated → HALT + operator clarification.

## Agent Response Summary Parsing

The validator attempts to extract a structured JSON summary from the agent's response (as defined in `TOOL_CONTRACTS.md`).
- **File Discovery**: Files listed in `files_created`, `files_updated`, or `changes` are automatically added to the list of artifacts to verify.
- **No-Change Optimization**: If `neededChanges: false` is present and status is `completed`, the validator may log high confidence (assuming the agent verified the existing state) without requiring file modification timestamps to change, provided all acceptance criteria are met.


## Task Type-Aware Validation

### Validation Routing by Task Type

The supervisor routes validation based on the `task_type` field. This ensures that conversational tasks aren't penalized for missing code changes and implementation tasks are strictly verified.

### Behavioral Validation Rules

Behavioral tasks (`task_type: "behavioral"`) focus on the agent's response text rather than file changes. Validation includes:
- **Keyword Patterns**: Checking for greetings, specific technical explanations, or required phrases using regex.
- **Constraints**: Verifying word counts (e.g., "Respond concisely") or response structure (e.g., "Respond in separate paragraphs").
- **Safety**: Behavioral tasks **skip the interrogation phase** because there are no file implementations to verify.

### File-Based Validation Rules (Existing)

Coding, testing, and configuration tasks verify physical changes in the sandbox:
- **Artifact Existence**: Ensuring required files were created/modified.
- **Content Verification**: Regex/keyword matching within the source code.
- **Test Execution**: Running `test_command` and requiring a zero exit code.
- **AST Validation**: Deep structural analysis (if supported by an AST Adapter).

### Why Interrogation Skips for Behavioral Tasks

Interrogation is designed to find "where" a change was made. Since behavioral tasks exist only in the conversation, asking "where is the code" would result in false negatives. Thus, the supervisor skips interrogation for behavioral tasks to speed up execution.

### Confidence Scoring

| Level | Meaning |
|-------|---------|
| **HIGH** | Explicit evidence found (files exist, tests pass, regex matches). |
| **MEDIUM** | Evidence inferred but less certain. |
| **UNCERTAIN** | (Coding only) Evidence missing or weak; triggers Interrogation. |
| **LOW** | (Coding only) Interrogation failed to clarify; triggers Retry. |

*Note: Behavioral tasks only result in HIGH or FAILED status.*
