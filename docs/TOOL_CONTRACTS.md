# Tool Contracts

## Allowed Actions
- Execute tasks as specified.
- Receive state context injected by supervisor in task prompt.
- Produce artifacts per instructions.

## Forbidden Actions
- Cursor CLI must not redefine tasks.
- Cursor CLI must not expand scope.
- Cursor CLI must not exit AUTO MODE.
- Cursor cannot enqueue tasks.
- Cursor cannot reorder tasks.
- Cursor cannot approve itself.
- Cursor cannot mutate state.

## Required Outputs
- Task completion status.
- Validation results.
- Artifacts produced.

## Failure Conditions
- Cursor CLI must halt if information is missing.

## Tool Implementation
- Supervisor uses Cursor CLI to dispatch tasks.
- Cursor outputs are untrusted input.
- Supervisor treats Cursor output like user-submitted code.

## Cursor Prompt Construction

Every task dispatched to Cursor must include:
- Task ID
- Task description (verbatim from operator)
- Acceptance criteria (verbatim)
- Injected state snapshot (explicit section)
- Explicit instruction to remain in AUTO MODE
- Explicit instruction to halt on ambiguity
- Explicit output format requirement

The Cursor agent must never infer missing information.

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

