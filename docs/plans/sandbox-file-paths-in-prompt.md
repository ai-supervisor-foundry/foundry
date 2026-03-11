# Plan: Sandbox file paths in prompt (relevant changed only)

## Goal

Expose **relevant file paths** (changed under `sandbox/<PROJECT>`) to the task prompt so providers (Cursor, Gemini, Ollama, etc.) and downstream logic can reason about which files are in play, without sending full file contents.

Only **changed** files under the task’s project/sandbox should be included, not the entire tree.

## Current state

- The prompt builder passes **no file paths** to the model.
- It only passes:
  - `minimalState.project.sandbox_root` (one directory path),
  - task metadata, recent completed tasks, blockers, etc.
- So the model has no list of files (and no list of “what changed”) for the project.

## Requirements

1. **Scope**: Paths must be under the task’s sandbox root (`sandbox/<PROJECT>` or the resolved `sandboxCwd`).
2. **Relevance**: Only **changed** files (e.g. git working tree + staged), not every file under the tree.
3. **Format**: Paths **relative to the sandbox root** (e.g. `src/index.ts`, `package.json`).
4. **No content**: Only paths; no file contents in this plan (can be a follow-up).
5. **Failure-safe**: If not in a git repo or git fails, return an empty list; do not break the prompt build.

## Proposed approach

1. **Extend `MinimalState`**  
   Add an optional field, e.g. `file_paths?: string[]`.

2. **Implement “changed files” under sandbox root**
   - Resolve the **git root** that contains the sandbox project dir (walk up from `sandboxCwd` until `.git` exists).
   - If none, return `[]`.
   - Run from that git root:
     - `git diff --name-only` (working tree changes),
     - `git diff --name-only --cached` (staged).
   - Normalize paths (e.g. forward slashes) and filter to paths that lie **under** the project (using `path.relative(gitRoot, sandboxCwd)` as the prefix).
   - Strip the prefix so each path is **relative to `sandboxCwd`**.
   - Deduplicate and cap at a max (e.g. 200) to avoid huge prompts.

3. **Wire into prompt**
   - In `buildMinimalState`, set `context.file_paths` to the result of the above.
   - The existing READ-ONLY CONTEXT block already does `JSON.stringify(minimalState, null, 2)`, so `file_paths` will appear in the prompt without further changes.

## Implementation notes

- **Location**: Logic belongs in `src/domain/agents/promptBuilder.ts` (or a small helper it calls). Use sync APIs so `buildMinimalState` stays synchronous (e.g. `execSync` for git, with a reasonable `maxBuffer`).
- **Git root**: Resolve by walking up from `sandboxCwd` and checking for `.git`; if `sandboxCwd` is outside the repo (e.g. `path.relative` starts with `..`), return `[]`.
- **Edge cases**: Not a git repo, git not installed, or sandbox not under repo → return `[]` and continue; do not throw.
- **Cap**: Use a constant (e.g. `MAX_SANDBOX_PATHS = 200`) to avoid unbounded prompt growth.

## Out of scope (this plan)

- Including file **contents** in the prompt (separate plan if needed).
- “Relevant” defined by anything other than git (e.g. task-specific or agent-reported paths) can be a later extension.
