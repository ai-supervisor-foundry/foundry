# Foundry Plans — Active Index

Completed plans: [`done/`](./done/) · Review: [`REVIEW-INSIGHTS.md`](./REVIEW-INSIGHTS.md)

## Follow-up plans (review-fixed, ready to implement)

| Plan | One-liner | Order |
|------|-----------|-------|
| [v2/02-hybrid-memory-hardening](./v2-architecture-gaps/02-hybrid-memory-hardening.md) | Null-key safety, CLI sandboxRoot, halt sync backup | **1** |
| [prompt-context/04-per-project-goal-check](./prompt-context/04-per-project-goal-check.md) | Per-project goal checks | **2** |
| [helper-agent/02-helper-fallback-chain](./helper-agent/02-helper-fallback-chain.md) | Ollama → secondary chain fallback | **3** |
| [observability/02-session-metrics-hardening](./observability/02-session-metrics-hardening.md) | Root persist, reload, estimated labels | **4** |

## Recently shipped (2026-06)

| Plan | Location |
|------|----------|
| Goal completion stopgap | [done/prompt-context/01-goal-completion-fix.md](./done/prompt-context/01-goal-completion-fix.md) |
| Sandbox file paths | [done/prompt-context/02-sandbox-file-paths.md](./done/prompt-context/02-sandbox-file-paths.md) |
| Local helper routing | [done/helper-agent/01-local-helper-routing.md](./done/helper-agent/01-local-helper-routing.md) |
| Session metrics v1 | [done/observability/01-session-metrics.md](./done/observability/01-session-metrics.md) |
| Hybrid memory fallback | [done/v2-architecture-gaps/02-hybrid-memory-fallback.md](./done/v2-architecture-gaps/02-hybrid-memory-fallback.md) |
| CRG YAGNI removal | [done/crg-yagni-removal/](./done/crg-yagni-removal/) |

## Other active (not started)

| Plan | One-liner |
|------|-----------|
| [prompt-context/03-pre-context-injection](./prompt-context/03-pre-context-injection.md) | Brief context on provider fallback / retry |
| [v2-architecture-gaps/01-safety-middleware](./v2-architecture-gaps/01-safety-middleware.md) | ToolMiddleware pipeline |
| [context-lifecycle/](./context-lifecycle/) | Checkpointing, handoff, halt dump |
| [infrastructure/](./infrastructure/) | Dragonfly pub/sub, CLI refactor |
| [webhooks/](./webhooks/) | CI → auto-create tasks |
| [operator-takeover/](./operator-takeover/) | UI chat takeover |
| [sandbox-isolation-docs/](./sandbox-isolation-docs/) | Doc-only: fix per-project state key/queue claims |
| [functional-test/](./functional-test/) | Scenario test suite |
| [arccli-context-loop-enhancements/](./arccli-context-loop-enhancements/) | Arc-cli extracted |
| [pi-foundry-client/](./pi-foundry-client/) | Foundry UI cockpit: prompt→AC confirm→task; stream + per-task cancel |
