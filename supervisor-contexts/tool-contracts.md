# Tool Contracts

## Provider CLI Integration

The supervisor uses provider CLIs to dispatch tasks. Provider CLIs are treated as **worker tools**, not decision authority.

### Allowed Actions
- Execute tasks as specified
- Receive state context injected by supervisor in task prompt
- Produce artifacts per instructions

### Forbidden Actions
- Provider CLIs must **not** redefine tasks
- Provider CLIs must **not** expand scope
- Provider CLIs must **not** exit AUTO MODE
- Providers cannot enqueue tasks
- Providers cannot reorder tasks
- Providers cannot approve themselves
- Providers cannot mutate state

### Required Outputs
- Task completion status
- Validation results
- Artifacts produced

### Failure Conditions
- Provider CLIs must halt if information is missing

## CLI Adapter

The supervisor uses a CLI adapter (`src/cliAdapter.ts`) that provides:
- **Priority-based provider selection**: Configurable fallback chain (default order set in config, adjustable via environment)
- **Circuit breaker**: 1-day TTL for failed providers
- **Automatic fallback**: On resource exhaustion or provider failure
- **Model filtering**: Only allowed models (sonnet*, opus*, gpt4*, gpt5*, gemini*)

## Cursor Prompt Construction

Every task dispatched to Cursor must include:
- Task ID
- Task description (verbatim from operator)
- Acceptance criteria (verbatim)
- Injected state snapshot (explicit section)
- Explicit instruction to remain in AUTO MODE
- Explicit instruction to halt on ambiguity
- Explicit output format requirement
- **WORKING DIRECTORY** instruction
- **AGENT MODE** instruction (if specified)

The Cursor agent must **never infer missing information**.
