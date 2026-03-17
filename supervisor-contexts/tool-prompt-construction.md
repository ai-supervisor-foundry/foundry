---
description: Detailed prompt construction rules for dispatched tasks
---

# Tool Prompt Construction

Parent: [tool-contracts.md](./tool-contracts.md)

## Required Prompt Fields

Every task dispatched to a provider CLI must include:

1. Task ID
2. Task description (verbatim from operator)
3. Acceptance criteria (verbatim)
4. Injected state snapshot (explicit section)
5. Explicit instruction to remain in AUTO MODE
6. Explicit instruction to halt on ambiguity
7. Explicit output format requirement
8. **WORKING DIRECTORY** instruction (`sandbox/{project_id}/`)
9. **AGENT MODE** instruction (if specified in task)

The agent must **never infer missing information**.

## Smart Context Injection

- **Base Context**: Project ID and Sandbox Root (always included)
- **Goal Context**: Included only if task intent relates to "goal"
- **Queue Context**: Included only if task references "previous" or "last" task
- **Completed Tasks**: Included only if task is "extending" or "building on" work

## Task-Type Guidelines (auto-injected)

- **Implementation**: Focus on code structure and patterns
- **Configuration**: Verify file locations and env vars
- **Testing**: Focus on edge cases and assertions
- **Documentation**: Ensure formatting and links
- **Refactoring**: Preserve functionality
