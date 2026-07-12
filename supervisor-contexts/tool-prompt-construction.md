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
8. **AGENT MODE** instruction (if specified in task)

The agent must **never infer missing information**.

## Smart Context Injection

- **Base Context**: Project ID and Sandbox Root (always included)
- **Goal Context**: Included only if task intent relates to "goal"
- **Queue Context**: Included only if task references "previous" or "last" task
- **Completed Tasks**: Included only if task is "extending" or "building on" work
- Git Changed Files (`file_paths`): tracked uncommitted + staged paths, relative to task sandbox cwd (project root or in-sandbox worktree when `MAX_WORKERS > 1`). Async via `gitContext.ts` (`execFile`; failure → `[]`). Untracked files excluded until staged.
- Git context cache: `buildMinimalState()` uses `state.active_tasks[task_id].git_context` keyed by `{retry_count}:{git_execution_seq}:{cwd}`. `git_execution_seq` bumps after each agent run; cache reused only within same seq.

Git diff: `gitContext.ts`, `gitContextCache.ts`; `promptBuilder.ts` → `resolveGitContextForTask()`.

## Task-Type Guidelines (auto-injected)

- **Implementation**: Focus on code structure and patterns
- **Configuration**: Verify file locations and env vars
- **Testing**: Focus on edge cases and assertions
- **Documentation**: Ensure formatting and links
- **Refactoring**: Preserve functionality
