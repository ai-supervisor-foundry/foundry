# Plan: Gemini Agent Reuse & Session Management

## Goal
Enable the Supervisor to reuse Gemini CLI sessions for related tasks, preserving context and improving efficiency.

## Core Requirements
1.  **Reuse**: Continue the same chat session for tasks tagged with the same `feature` or `task_id`.
2.  **Tagging**: Associate sessions with logical features/tasks.
3.  **Resume**: Capability to resume specific sessions by ID.
4.  **Cleanup/Restart Policy**:
    *   **Error Limit**: Restart if 3 consecutive errors/timeouts occur (with linear back-off).
    *   **Context Limit**: Restart if context > 350,000 tokens (monitored via CLI stats). *Note: Original requirement mentioned "compressed and still > 50k". Since we cannot easily inspect internal compression state, we will use a hard restart limit of 350k tokens as a safety proxy.*
5.  **Smart Selection (Recovery)**:
    *   Before starting a new chat (if none in state), list all sessions.
    *   Check sessions from the **last 1 week**.
    *   Match against `feature_id` or description.
    *   Use the matched session if found.

## Confirmed CLI Capabilities
- **JSON Output**: `gemini -o json "prompt"` returns `{ "session_id": "...", "stats": { ... } }`.
- **List Sessions**: `gemini --list-sessions` returns text format: `1. Message Snippet (Time) [UUID]`.
- **Resume**: `gemini -r <UUID>` works.

## Architecture Changes

### 1. Task Schema Update (`TASK_SCHEMA.json` & `src/types.ts`)
Add metadata to link tasks to features/sessions.
```typescript
interface Task {
  // ... existing fields
  meta?: {
    feature?: string; // Logical grouping (e.g., "auth-module")
    session_id?: string; // Specific override
  };
}
```

### 2. State Management (`STATE_SCHEMA.json` & `src/types.ts`)
Track active sessions in Supervisor state.
```typescript
interface SessionInfo {
  session_id: string;
  last_used: string; // ISO date
  error_count: number;
  total_tokens: number;
  feature_id: string;
}

interface SupervisorState {
  // ... existing fields
  active_sessions: {
    [feature_id: string]: SessionInfo;
  };
}
```

### 3. Gemini CLI Dispatcher (`src/providers/geminiCLI.ts`)
Refactor to support JSON output, Session ID injection, and List parsing.

*   **Command Execution**:
    *   Use `-o json`.
    *   Add `-r <sessionId>` if resuming.
    *   **Prompt Header**: Prepend `[Feature: <feature_id>]` to the *first* prompt of a session to enable discovery.

*   **Output Parsing**:
    *   Strip non-JSON preamble.
    *   Parse JSON to extract `session_id` and `stats.models[].tokens.total`.

*   **Session Listing**:
    *   Implement `listSessions()` helper.
    *   Executes `gemini --list-sessions`.
    *   Parses text output with regex: `^\s+\d+\.\s+(.*)\s+\((.*)\)\s+\[(.*)\]`.
    *   Returns array of `{ snippet, timeRelative, uuid }`.

### 4. Control Loop Integration (`src/controlLoop.ts`)

#### A. Session Resolution
1.  **Check State**: Look for `state.active_sessions[feature_id]`.
2.  **Check Recovery (Smart Selection)**:
    *   If not in state, call `geminiCLI.listSessions()`.
    *   Filter for sessions within 1 week (exclude "weeks ago", "months ago").
    *   Search for snippet containing `[Feature: <feature_id>]`.
    *   If found, adopt that UUID and update state.

#### B. Policy Enforcement
1.  **Error Handling**:
    *   If `error_count >= 3`, clear session and force restart.
    *   **Linear Back-off**: On error, sleep for `error_count * 10s` before next retry (managed by Supervisor loop).
2.  **Context Limit**:
    *   If `total_tokens > 350,000`, clear session and force restart.

#### C. Execution
1.  Pass `sessionId` to `cliAdapter`.
2.  Update state with result (new `session_id`, `token_usage`, reset `error_count` on success).

## Implementation Steps

1.  **Schema**: Update `src/types.ts` with `SessionInfo` and `meta` fields.
2.  **CLI Refactor**: Implement `geminiCLI.ts` changes (JSON support, `listSessions` parser).
3.  **Control Logic**: Implement session resolution, recovery, and policy logic in `controlLoop.ts`.
4.  **Verification**: Test with specific feature tags and verify reuse/recovery.

## Constraints
- **Mixed Output**: CLI text output must be sanitized before JSON parse.
- **Time Parsing**: Relative time parsing ("2 days ago") is approximate but sufficient.
- **Prompt Header**: We rely on the *first* prompt having the tag. If the session history is compressed/summarized, this might be lost in the "snippet" view? 
    *   *Mitigation*: The `list-sessions` command shows the *first* user message snippet. This usually persists as the session title.

## Verification
- Test creating a session.
- clear state (simulate crash).
- Run task again -> should find session via `list-sessions` (Smart Recovery).
- Verify token limit triggers new session.
