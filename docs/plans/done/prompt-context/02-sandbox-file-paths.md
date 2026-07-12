# Plan: Sandbox file paths in prompt (relevant changed only)

**Status:** COMPLETED (2026-06-13) — hardening in [05-shared-git-context.md](../code-review-graph/05-shared-git-context.md) (done 2026-06-14).

## Goal

Expose **relevant file paths** (changed under `sandbox/<PROJECT>`) to the task prompt so providers (Cursor, Gemini, Ollama, etc.) and downstream logic can reason about which files are in play, without sending full file contents.

Only **changed** files under the task's project/sandbox should be included, not the entire tree.

## Requirements

1. **Scope**: Paths must be under the task's sandbox root (`sandbox/<PROJECT>` or the resolved `sandboxCwd`).
2. **Relevance**: Only **changed** files (e.g. git working tree + staged), not every file under the tree.
3. **Format**: Paths **relative to the sandbox root** (e.g. `src/index.ts`, `package.json`).
4. **No content**: Only paths; no file contents in this plan (can be a follow-up).
5. **Failure-safe**: If not in a git repo or git fails, return an empty list; do not break the prompt build.

## Implementation

1. **Extended `MinimalState`** with optional `file_paths?: string[]`.
2. **Added `getGitChangedSandboxPaths(sandboxCwd)`** in `src/domain/agents/promptBuilder.ts`:
   - Walk up from `sandboxCwd` to find `.git`; return `[]` if none or sandbox is outside repo.
   - Run `git diff --name-only` and `git diff --name-only --cached` from git root.
   - Filter to paths under the sandbox prefix, strip prefix for sandbox-relative paths, dedupe, cap at 200.
3. **Wired into `buildMinimalState`**: always sets `context.file_paths` (empty array on failure).
4. **Unit tests** in `tests/unit/domain/promptBuilder.test.ts` (temp git dirs + mocked `execSync`).

## Out of scope (this plan)

- Including file **contents** in the prompt (separate plan if needed).
- "Relevant" defined by anything other than git (e.g. task-specific or agent-reported paths) can be a later extension.
