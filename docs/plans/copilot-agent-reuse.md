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
  - Use `copilot` command; prefer a configured `COPILOT_CLI_PATH` env var.
  - Core call examples:
    - Start new session (non-interactive prompt): `copilot --agent=<agent> --prompt "<prompt>"`
    - Resume specific session: `copilot --resume <sessionId> --prompt "<prompt>"` or emulate by sending selection to stdin if necessary.
    - Get usage: run `copilot --usage` in session context or `copilot` with `/usage` command sent via stdin.
  - Implement careful timeout handling (30 minutes by default), capture stdout/stderr verbatim.

- Session id extraction & usage parsing:
  - If `copilot` prints session metadata (session id, usage), parse stdout with robust regexes.
  - If `copilot` exposes `/usage` and we can run it programmatically, parse the lines to get `tokens` and `duration`.
  - Provide best-effort token usage reporting (may be `undefined` if not available).

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
  - Mock subprocess outputs for: start session, resume session, tool approval prompt, `/usage` output, error conditions.
  - Validate session_id extraction, usage parsing, and rejection on approval request.
- Integration tests (optional): run small local Copilot CLI tasks in a trusted sandbox (manual approval required); verify session resume between attempts.

## Acceptance criteria

- New `copilotCLI` adapter exists and exposes `dispatchToCopilot` with session resume support.
- State stores session metadata and updates it after each successful call.
- Adapter fails clearly when tool-approval or trust is required and surfaces a `TOOL_APPROVAL_REQUIRED` error in the result.
- Tests exist for parsing session id and usage from sample outputs.

## Implementation plan (Milestones)

1. Research CLI flags & output (non-interactive listing & resume) — experimental shell checks. (2d)
2. Implement `src/providers/copilotCLI.ts` — start/resume/list/usage APIs. (2d)
3. Add state schema and small helper in `persistence.ts` for storing sessions. (0.5d)
4. Integrate into `src/cliAdapter.ts` as a Provider option and add provider-specific error detection in `shouldTriggerCircuitBreaker`. (1d)
5. Add unit tests (mocked subprocesses) and basic integration tests (if feasible). (1.5d)
6. Documentation: add README notes and update `docs/plans`. (0.5d)

## Open questions / Risks

- Exact non-interactive session listing and programmatic `session_id` extraction need verification — may require trial with actual `copilot` CLI outputs.
- Automating approvals is risky; safer choice is to require operator prior trust/approval for directories and fail with a clear message if interactive approval is demanded.
- Copilot CLI may change (preview) — adapter must be resilient to CLI output changes and have clear fallbacks.

---

*Next step*: implement experimental shell checks to find reliable non-interactive flags and session listing outputs. Add the experimental scripts under `scripts/` as `test-copilot-cli-list.sh` and `test-copilot-cli-resume.sh` for reproducible experimentation.
