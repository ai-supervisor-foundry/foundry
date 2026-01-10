# Tool Contracts

## Allowed Actions
- Execute tasks as specified.
- Receive state context injected by Foundry in task prompt.
- Produce artifacts per instructions.

## Forbidden Actions
- Provider CLIs must not redefine tasks.
- Provider CLIs must not expand scope.
- Provider CLIs must not exit AUTO MODE.
- Providers cannot enqueue tasks.
- Providers cannot reorder tasks.
- Providers cannot approve themselves.
- Providers cannot mutate state.

## Required Outputs
- Task completion status.
- Validation results.
- Artifacts produced.

## Failure Conditions
- Provider CLIs must halt if information is missing.

## Tool Implementation
- Foundry uses provider CLIs to dispatch tasks.
- Provider outputs are untrusted input.
- Foundry treats provider output like user-submitted code.

## Provider Prompt Construction

Every task dispatched to a provider must include:
- Task ID
- Task description (verbatim from operator)
- Acceptance criteria (verbatim)
- Injected state snapshot (explicit section)
- Explicit instruction to remain in AUTO MODE
- Explicit instruction to halt on ambiguity
- Explicit output format requirement

The provider agent must never infer missing information.

## Output Format Contract

Agents must conclude their response with a JSON summary block in this exact format. No other fields are allowed.

```json
{
  "status": "completed" | "failed",
  "files_created": ["path/to/file"],  // Optional
  "files_updated": ["path/to/file"],  // Optional
  "changes": ["path/to/file"],        // Optional (alias for files_updated)
  "neededChanges": true | false,      // Optional (false if no changes were needed)
  "summary": "Brief description of work done"
}
```

## Final Instruction

If any implementation decision is not explicitly specified above or in the refresher, STOP and ask for operator clarification. Do not assume.

