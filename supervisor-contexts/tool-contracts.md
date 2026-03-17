---
description: Provider CLI integration contracts and adapter rules
---

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

## Prompt Construction

Every dispatched task includes: task ID, description (verbatim), acceptance criteria (verbatim), state snapshot, AUTO MODE instruction, halt-on-ambiguity instruction, output format, working directory, and agent mode. Agents must **never infer missing information**.

Full prompt construction details: [tool-prompt-construction.md](./tool-prompt-construction.md)
