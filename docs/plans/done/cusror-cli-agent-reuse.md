# Plan: Cursor CLI Agent Reuse & Session Management

## Goal
Enable the Supervisor to reuse Cursor CLI sessions ("threads") for related tasks, preserving context and improving efficiency.

## Core Requirements
1.  **Reuse**: Continue the same chat thread for tasks tagged with the same `feature` or `task_id`.
2.  **Tagging**: Associate threads with logical features/tasks.
3.  **Resume**: Capability to resume specific threads by ID.
4.  **Cleanup/Restart Policy**:
    *   **Error Limit**: Restart if 3 consecutive errors/timeouts occur (linear back-off).
    *   **Context Limit**: Restart if context exceeds safe limits (monitor via usage stats if available).

## Confirmed CLI Capabilities
- **Command**: `cursor agent [options] [prompt]`
- **Resume**: `--resume [chatId]` global flag.
- **Output Format**: `--output-format json` (works with `--print`).
- **Listing**: `cursor agent ls` is **INTERACTIVE ONLY** (TUI). We cannot use it for automated discovery.
- **Storage**: Local storage exists in `~/.cursor/chats/` but the format is complex (Hash -> UUIDs). Reverse engineering is out of scope for V1.

## Architecture Changes

### 1. Task Schema Update (`src/domain/types/types.ts`)
(Shared with Gemini/Copilot reuse plans)
```typescript
interface Task {
  meta?: {
    feature?: string;
    session_id?: string; // Can be used to force a specific thread
  };
}
```

### 2. State Management (`src/domain/types/types.ts`)
Update `SessionInfo` to be generic or provider-specific.
```typescript
interface SessionInfo {
  session_id: string; // "chatId" in Cursor
  last_used: string;
  error_count: number;
  total_tokens?: number;
  provider: 'cursor' | 'gemini' | 'copilot';
  feature_id: string;
}

interface SupervisorState {
  active_sessions: {
    [feature_id: string]: SessionInfo;
  };
}
```

### 3. Cursor CLI Dispatcher (`src/infrastructure/connectors/agents/providers/cursorCLI.ts`)
Refactor `dispatchToCursor` to support reuse.

*   **Command Construction**:
    *   If `sessionId` provided: Add `--resume <sessionId>`.
    *   Always use `--output-format json` to capture metadata.
    *   **Prompt Header**: Prepend `[Feature: <feature_id>]` to the *first* prompt (mostly for debugging/logging, since discovery is disabled).

*   **Output Parsing**:
    *   Parse JSON output.
    *   Extract `chatId` (or equivalent ID field) from the response.
    *   Extract usage/token stats if available.
    *   Handle "BLOCKED" and "FAILED" statuses robustly.

*   **Session Listing (Discovery)**:
    *   **SKIPPED for V1**. `cursor agent ls` is interactive. We will rely purely on `SupervisorState` for session tracking. If state is lost, we start a new session.

### 4. CLI Adapter (`src/infrastructure/adapters/agents/providers/cliAdapter.ts`)
Update `execute` signature to accept `sessionId` and pass it to `dispatchToCursor`.

### 5. Control Loop Integration (`src/application/entrypoint/controlLoop.ts`)
(Shared logic with Gemini reuse)
*   **Resolution**: `sessionManager.resolveSession(Provider.CURSOR, featureId, ...)`
    *   *Note*: For Cursor, this will only check State. No "Discovery" fallback.
*   **Execution**: Pass `sessionId` to `cliAdapter`.
*   **Update**: Save new/updated `sessionId` to state.

## Implementation Steps

1.  **Schema**: Update `src/domain/types/types.ts` (if not already done).
2.  **CLI Refactor**:
    *   Modify `cursorCLI.ts` to use JSON output and handle `--resume`.
    *   Implement robust JSON parsing (handling potential non-JSON stdout noise).
3.  **Session Manager**: Update `SessionManager` to handle Cursor (state-only lookup).
4.  **Verification**: Test creation and reuse of Cursor threads using state persistence.

## Verification Plan
1.  Run `cursor agent --print --output-format json "hello"` to confirm JSON structure (once resource limits allow).
2.  Verify `chatId` field presence in output.
3.  Implement and test with a sample task sequence: Task A (creates session) -> Task B (reuses session).