# Documentation Refresh Plan (Audit: 2026-01-09)

## Scope
- Audit README.md and non-plan docs under docs/*.md against last week changes: prompt tightening, helper agent optimization, session reuse, AST/validation upgrades, provider-agnostic dispatch.
- Deliver targeted edits; no content changes applied yet.
- Style note: refer to Agents/Providers with examples in parentheses, e.g., "Agents/Providers (Gemini, Copilot, Cursor)", unless the doc is explicitly provider-specific.

## Findings & Proposed Updates

### README.md
- Add high-level summary of deterministic pre-validation (semver/regex/caps), helper-agent fallback, session reuse, and cache-aware metrics.
- Update provider wording (Gemini/Copilot/Cursor) + session reuse flags; remove Cursor-only bias.
- Document new pipeline stages: deterministic validator → provider execution → helper agent → analytics/metrics JSONL.
- Quickstart should mention env flags (HELPER_DETERMINISTIC_ENABLED, HELPER_DETERMINISTIC_PERCENT, DISABLE_SESSION_REUSE), and session reuse behavior (featureId grouping, context limits).
- Architecture section: include ASTService, ValidationCache, SessionManager, AnalyticsService; note provider-agnostic queue (no BullMQ) and helper session isolation.

### docs/PROMPT.md
- Currently minimal/empty; add consolidated Rules block from promptBuilder (no paraphrase, JSON-only, path validation), Output Requirements schema, task-type guidelines, and tightened fix/clarify prompt behavior.
- Include file path validation rules and minimal state injection policy.

### docs/ARCHITECTURE.md
- Remove Cursor-only references; describe provider abstraction and session reuse.
- Add components: DeterministicValidator, Helper Agent pipeline, SessionManager, AnalyticsService, ValidationCache.
- Clarify queue/persistence (Redis lists/state) instead of BullMQ.

### docs/LOOP.md
- Update loop steps to reflect deterministic pre-check, session resolution, provider execution with reuse, helper agent invocation, and analytics persistence.
- Make provider phrasing generic (not Cursor-only).

### docs/LOGGING.md
- Expand required logs: deterministic results, session resolution (new/resumed, context limits), helper agent durations and cache stats, validation outcomes, state diffs, halt reasons.
- Note metrics JSONL file and periodic summaries.

### docs/RUNBOOK.md
- Update run steps to include env flags for deterministic + session reuse; mention provider selection; add helper-agent/session troubleshooting (cache hit expectations, context limits).
- Add quick checks: grep for "Resuming helper session", cache hit rate logs, deterministic skip/execute logs.

### docs/VALIDATION.md
- Add deterministic validator overview (confidence tiers, catastrophic regex guard, file/byte caps, semver matching) and how it gates helper.
- Document helper-agent role in validation, session reuse for helpers, and cache-hit stats.
- Keep behavioral task routing but add note about new task-type expansion work (see task-type-system-redesign plan) pending implementation.

### docs/ARCHITECTURE_DETAILED.md (spot-check)
- Inject provider-agnostic wording, deterministic/helper/session components, and updated context limits policy.

### docs/SUPERVISOR_STATES.md / STATE_* (follow-up if time permits)
- Verify fields for active_sessions, metrics, deterministic flags; add brief notes if missing.

## Next Steps
1) Update README.md with pipeline, flags, and provider-agnostic language.
2) Rewrite PROMPT.md to mirror current promptBuilder: Rules, Output schema, guidelines, path validation.
3) Refresh ARCHITECTURE.md + LOOP.md to include deterministic/helper/session flows and generic providers.
4) Extend LOGGING.md + RUNBOOK.md with new observability and troubleshooting steps.
5) Append deterministic/helper/session details to VALIDATION.md.
6) Quick pass on ARCHITECTURE_DETAILED.md and state docs for consistency.
