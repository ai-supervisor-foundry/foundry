# Control Loop

1. Load persisted state.
2. Read injected operator goal from state (built from initial operator instructions).
3. Select the next operator-defined task from queue.
4. Run deterministic pre-validation (caps, regex/semver, safe extensions) to skip helper when confidence is high.
5. Resolve session (feature-scoped) for Agents/Providers (Gemini, Copilot, Cursor); enforce context/error limits.
6. Dispatch task to provider CLI with injected minimal state context.
7. On validation gaps, invoke helper agent (session-reused) to generate verification commands.
8. Validate output (deterministic rules, AST/content checks, cache where applicable).
9. Record analytics/metrics; persist updated state.
10. Halt or continue per explicit instruction.

## Task List Rules

- Task list is treated as closed and authoritative.
- The supervisor may only: select next task, dispatch, validate, persist.
- Do not implement planning, decomposition, or task generation.
- If the task list is exhausted and the goal is incomplete → HALT.

