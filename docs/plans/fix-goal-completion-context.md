# Plan: Fix Goal Completion Check Context

## Problem
The `GOAL_COMPLETION_CHECK` failed with `Error: No such file or directory (os error 2)`.
This occurs because the check is executed inside a specific project subdirectory (e.g., `sandbox/easeclassifieds`), but the prompt provides paths relative to the sandbox root (e.g., `./sandbox/easeclassifieds-api`).

When the agent attempts to inspect the backend structure mentioned in the prompt, it tries to resolve `./sandbox/easeclassifieds-api` *relative* to its current directory (`sandbox/easeclassifieds`), resulting in an invalid path like `sandbox/easeclassifieds/sandbox/easeclassifieds-api`.

## Solution
Execute the Goal Completion Check from the **Sandbox Root** (`./sandbox` or just `.`) instead of the project-specific subdirectory. This allows the agent to correctly resolve paths to all projects (frontend and backend) as described in the prompt.

## Implementation Steps

1.  **Modify `src/controlLoop.ts`**:
    *   Locate the `GOAL_COMPLETION_CHECK` block (around line 450).
    *   Change the `working_directory` for the `cliAdapter.execute` call.
    *   **Current**: `const sandboxCwd = path.join(sandboxRoot, projectId);`
    *   **Proposed**: `const goalCheckCwd = sandboxRoot;` (or `process.cwd()` if we want full root access, but `sandboxRoot` is safer).

2.  **Update Prompt Context**:
    *   Ensure `buildGoalCompletionPrompt` describes paths relative to the directory where the agent is executing.
    *   If executing from `sandboxRoot`, paths like `easeclassifieds/` and `easeclassifieds-api/` are correct.

## Example Scenario

**Current Behavior (Failing):**
*   **CWD**: `sandbox/easeclassifieds`
*   **Prompt**: "Check Backend at ./sandbox/easeclassifieds-api"
*   **Agent Action**: `ls ./sandbox/easeclassifieds-api`
*   **System Resolve**: `sandbox/easeclassifieds/sandbox/easeclassifieds-api` -> **NOT FOUND**

**Proposed Behavior (Fixed):**
*   **CWD**: `sandbox/` (or root)
*   **Prompt**: "Check Backend at ./easeclassifieds-api"
*   **Agent Action**: `ls ./easeclassifieds-api`
*   **System Resolve**: `sandbox/easeclassifieds-api` -> **FOUND**

## Benefits
*   **Cross-Project Visibility**: The agent can verify completion across both frontend and backend projects in a single check.
*   **Reduced Errors**: Eliminates file-not-found errors caused by incorrect relative paths.
*   **Accurate Assessment**: Ensures the goal check is based on the actual state of the entire project, not just the active subdirectory.
