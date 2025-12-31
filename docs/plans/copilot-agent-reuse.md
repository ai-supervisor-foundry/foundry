# Plan: GitHub Copilot CLI Adapter — Reusable Session Support

## Goal

Implement a provider adapter for **GitHub Copilot CLI** with built-in support for reusable sessions (resume), session discovery, usage tracking, and safe automation policies. The adapter should be usable from the `CLIAdapter` fallback chain and should expose programmatic functions to: start sessions, resume sessions, list sessions, and fetch session usage metadata.

## Motivation

- Copilot CLI supports interactive sessions, resuming sessions, custom agents, and usage stats — reusing sessions for related tasks reduces cost, preserves context for retries/interrogations, and improves success rates.
- Other providers (Gemini, Cursor) have reuse plans in docs; Copilot adapter should adopt the same patterns and restrictions (safety, approval prompts, token limits, restart policy).

## High-level design

Files added/changed:
- `src/providers/copilotCLI.ts` — New adapter with functions:
  - `dispatchToCopilot(prompt, cwd, agentMode, sessionId?, options?)` — core execution entry
  - `listSessions()` — discover existing sessions (if supported non-interactively)
  - `resumeSession(sessionId, prompt, cwd, agentMode)` — resume an existing session
  - `getSessionUsage(sessionId)` — retrieve usage stats or parse `/usage` output
- `src/cliAdapter.ts` — register Provider.COPILOT and enable priority insertion
- `src/types.ts` / `STATE_SCHEMA.json` — extend state with `SessionInfo` for Copilot sessions
- `docs/plans/copilot-agent-reuse.md` — this file (proposal)

Policy & behavior:
- Session identity: sessions are tracked by `session_id` (string) and associated with `project_id` and optionally `task_id` or `meta.feature`.
- Resume heuristics:
  - If a task has `meta.session_id`, attempt to resume it.
  - Else, attempt to find session by `meta.feature` or `project_id` and `agentMode`.
  - If none found, start new session and store session_id in state under `state.active_sessions[feature_id]` and optionally under `task_threads[task_id]`.
- Restart policy:
  - Clear and restart session after `error_count >= 3` consecutive failures or when `total_tokens` > token threshold (configurable, e.g., 200k tokens).
  - Linear backoff on errors (e.g., errorCount * 10s).
- Safety/Approvals:
  - Copilot CLI may require directory trust and tool approvals. For automation:
    - Require repository directory to be trusted before running (fail with actionable error if not trusted).
    - Do NOT auto-approve arbitrary destructive commands. If Copilot asks for interactive tool approvals, the provider should fail and surface a `TOOL_APPROVAL_REQUIRED` condition (operator must approve manually or configure safe approvals).
- Non-interactive mode & session listing:
  - The docs show `--resume` and `--continue`, `/usage`, and `--agent` flags; exact non-interactive session listing or JSON output is unclear — the implementation will:
    1. Experimentally detect CLI flags that allow non-interactive listing (e.g., `copilot --list-sessions`, `copilot --resume <id> --prompt "..."`), and parse outputs.
    2. If listing isn't available non-interactively, use `copilot --resume` with an automated selection via stdin (careful) or fallback to starting a new session.

## State schema changes

Add to `SessionInfo` and `SupervisorState`:

```ts
interface SessionInfo {
  session_id: string;
  last_used: string; // ISO
  error_count: number;
  total_tokens?: number;
  feature_id?: string; // optional grouping
  task_id?: string;
}

// SupervisorState.active_sessions: { [feature_id: string]: SessionInfo }
```

## Adapter implementation details

- Command builder:
  - Use `copilot` command (check existence) or fallback to `gh copilot`; prefer a configured `COPILOT_CLI_PATH` env var.
  - Core call examples:
    - Start new session (non-interactive prompt): `copilot --model <model> --prompt "<prompt>"` (Note: some models like `claude-sonnet-4.5` may require interactive mode initially; use `gpt-4.1` or `gpt-4o` as reliable non-interactive fallbacks if needed).
    - Resume specific session: `copilot --resume <sessionId> --prompt "<prompt>"`
    - Get usage: parse the stdout footer (e.g., "Total usage est: ...") or rely on session log analysis.
  - Implement careful timeout handling (30 minutes by default), capture stdout/stderr verbatim.

- Session Discovery & Persistence:
  - **Discovery**: The CLI does not have a machine-readable `list-sessions` command. However, session state is stored in `~/.copilot/session-state/*.jsonl`.
    - The adapter will implement `listSessions()` by scanning this directory.
    - Parse the most recent `.jsonl` files to extract `sessionId`, `startTime`, and `last_used` (from file mtime or last log entry).
    - This allows discovering sessions even if they weren't created by this specific adapter instance (e.g. user created one interactively).
  - **Persistence**: We will still track sessions in our `state.json` to map them to `feature_id` or `task_id`.
  - **Resume Logic**:
    1. Check `state.active_sessions`.
    2. If not found, scan `~/.copilot/session-state/` for a recent session (optional heuristic).
    3. Else start new.

- Session id extraction & usage parsing:
  - When starting a new session, the CLI output does *not* explicitly print the Session ID in non-interactive mode.
  - **Strategy**: After starting a session, scan `~/.copilot/session-state/` for the most recently modified file. The filename or the first line of the JSONL content contains the `sessionId`.
  - Usage parsing: Parse the "Total usage est" and "Usage by model" sections from stdout to approximate token usage.

- Tool approval handling:
  - Detect prompts that ask for approval (e.g., `Allow Copilot to use (tool)...`); surface a special error and do not auto-approve.

## Control loop integration

- When dispatching a task, the control loop should:
  1. Look for `task.meta.session_id` or `task.meta.feature`.
  2. Ask `cliAdapter` to execute with `sessionHint`.
  3. After execution, update `state.active_sessions[feature_id]` with `session_id`, `last_used`, `total_tokens` if known, and reset `error_count` on success.
  4. On failures, increment error_count and apply restart policy if threshold exceeded.

## Tests & verification

- Unit tests for `src/providers/copilotCLI.ts`:
  - Mock subprocess outputs for: start session, resume session, tool approval prompt, usage stats.
  - Mock file system for `~/.copilot/session-state/` to test session discovery.
  - Validate session_id extraction, usage parsing, and rejection on approval request.
- Integration tests (optional): run small local Copilot CLI tasks in a trusted sandbox; verify session resume between attempts.

## Acceptance criteria

- New `copilotCLI` adapter exists and exposes `dispatchToCopilot` with session resume support.
- Adapter can discover session IDs by inspecting `~/.copilot/session-state/`.
- State stores session metadata and updates it after each successful call.
- Adapter fails clearly when tool-approval or trust is required.
- Tests exist for parsing session logs and usage from sample outputs.

## Implementation plan (Milestones)

1. **Session Discovery POC**: Write a script/helper to parse `~/.copilot/session-state/` and extract session IDs reliable. (0.5d)
2. **Adapter Core**: Implement `src/providers/copilotCLI.ts` — start/resume/list. (1.5d)
   - Include logic to find the new session ID after a `start` command by checking file mtimes.
3. **State Integration**: Add schema support in `types.ts` and `persistence.ts`. (0.5d)
4. **Main Integration**: Hook into `src/cliAdapter.ts` and `shouldTriggerCircuitBreaker`. (0.5d)
5. **Testing**: Unit tests for log parsing and command construction. (1d)
6. **Documentation**: Update `docs/plans` and `README`. (0.5d)

## Open questions / Risks

- Race conditions: If multiple sessions start simultaneously, identifying the correct file in `session-state` by mtime might be flaky. (Mitigation: wait a split second or check content for model/prompt match if possible, but strict process isolation in Supervisor helps).
- Directory structure changes: GitHub Copilot CLI internals (log paths) may change. Adapter needs error handling if paths don't exist.


---

*Next step*: implement experimental shell checks to find reliable non-interactive flags and session listing outputs. Add the experimental scripts under `scripts/` as `test-copilot-cli-list.sh` and `test-copilot-cli-resume.sh` for reproducible experimentation.
