# Validation

## Validation Rules

- Validation logic must be **deterministic, rule-based, and non-AI**
- Examples: file exists, tests pass, diff matches criteria, artifact count matches expectation
- If validation cannot be automated → HALT + operator clarification

## Validation Process

1. **Helper Agent Phase (V2)** (optional):
   - If validation fails, supervisor uses a separate agent instance to generate read-only validation commands.
   - **Session Reuse**: Helper Agents persist their session context across invocations, significantly reducing latency and enabling learning from previous attempts.
   - **Code Discovery**: The Helper Agent is provided with a list of actual filenames from the codebase to prevent hallucinations.
   - **Proactive**: Automatically triggered on validation failure.
   - Commands are executed to verify criteria.
   - If commands pass, interrogation is skipped, and task is marked complete.

2. **Validation Scoring**:
   - Calculates `MatchQuality` for each criterion: `EXACT` (strongest), `HIGH`, `MEDIUM`, `LOW`, `NONE`.
   - Overall `confidence` is derived from the lowest quality match.
   - If `confidence` is `UNCERTAIN` or `LOW` (with weak matches), interrogation is triggered even if technically "passed" by regex.

3. **Targeted Interrogation Phase** (if Helper Agent fails or confidence is low):
   - **Pre-Analysis**: Before asking, the system scans the codebase for keywords related to the failed criteria.
   - **Targeted Prompts**: The interrogation prompt includes these potential file locations ("We found X, is this it?").
   - Supervisor engages in sequential Q&A with the agent (max 4 rounds).
   - Batches all unresolved criteria into a single prompt per round.

4. **Validation Result**:
   - Returns `confidence: 'HIGH' | 'LOW' | 'UNCERTAIN'`.
   - Returns `failed_criteria` and `uncertain_criteria`.
   - If `HIGH` confidence → task marked complete.
   - If `LOW` or `UNCERTAIN` → retry with fix prompt.
   - **Smart Retry**: If the agent fails with the exact same error twice, the retry prompt switches to "Strict Mode" to force a different approach.

## Prompt Construction

The supervisor uses **Smart Context Injection** to minimize token usage and focus the agent:

- **Base Context**: Project ID and Sandbox Root (always included).
- **Goal Context**: Included only if task intent relates to "goal".
- **Queue Context**: Included only if task references "previous" or "last" task.
- **Completed Tasks**: Included only if task is "extending" or "building on" work (omitted for documentation tasks).

**Strict Prompt Rules**:
- **Consolidated Rules**: A single, strict "Rules" block enforces agent behavior (no speculation, stop on ambiguity).
- **Output Requirements**: Agents must output **ONLY** a specific JSON structure (no conversational filler).
- **Path Validation**: All file paths in the agent's response are validated against the filesystem to filter hallucinations.

**Task-Type Guidelines**:
Prompts automatically include specific guidelines based on detected task type:
- **Implementation**: Focus on code structure and patterns.
- **Configuration**: Verify file locations and env vars.
- **Testing**: Focus on edge cases and assertions.
- **Documentation**: Ensure formatting and links.
- **Refactoring**: Preserve functionality.

## Validation Checklist

- [ ] Was output generated for the specified task?
- [ ] Does output meet all acceptance criteria?
- [ ] Are test outputs present (if `tests_required: true`)?
- [ ] Are required artifacts present?
- [ ] Is state updated appropriately?
