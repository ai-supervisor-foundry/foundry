# ARC-CLI Extraction Plan — Index

## What Is ARC-CLI?

A Rust-based AI coding CLI (31 crates, ~15MB binary). Claude Code competitor with
multi-provider routing, session forking, hook system, A2A protocol, plugin architecture,
and OS-level sandboxing. v0.5.0 — partially aspirational but well-architected.

## Goal

Extract portable patterns, schemas, and algorithms from arc-cli and integrate the
best into the Supervisor/Foundry (TypeScript) project.

## Plan Files

| # | File | Topic | Priority |
|---|------|-------|----------|
| 1 | [01-memory-compaction.md](./01-memory-compaction.md) | Tiered memory + context compaction | P0 |
| 2a | [02a-plan-schema.md](./02a-plan-schema.md) | Plan data model + step actions | P0 |
| 2b | [02b-dag-topo-sort.md](./02b-dag-topo-sort.md) | Dependency graph + Kahn's topological sort | P0 |
| 3a | [03a-hook-engine.md](./03a-hook-engine.md) | Hook events, dispatch, execution protocol | P0 |
| 3b | [03b-hook-config-presets.md](./03b-hook-config-presets.md) | Hook config schema + 5 security presets | P0 |
| 4a | [04a-command-injection.md](./04a-command-injection.md) | Command injection filter + sandbox modes | P0 |
| 4b | [04b-path-traversal.md](./04b-path-traversal.md) | Path traversal guard + file protection | P0 |
| 4c | [04c-secret-redaction.md](./04c-secret-redaction.md) | SecretString, redaction pipeline, OWASP | P0 |
| 5a | [05a-circuit-breaker.md](./05a-circuit-breaker.md) | Circuit breaker + failure classification | P1 |
| 5b | [05b-routing-racing.md](./05b-routing-racing.md) | Task-based routing + parallel racing | P1 |
| 6a | [06a-static-policy.md](./06a-static-policy.md) | Static policy engine + default rules | P1 |
| 6b | [06b-conseca-dynamic.md](./06b-conseca-dynamic.md) | Conseca LLM-generated dynamic policy | P1 |
| 7a | [07a-snapshots.md](./07a-snapshots.md) | Session snapshots + file state | P1 |
| 7b | [07b-fork-tree.md](./07b-fork-tree.md) | Fork tree manager | P1 |
| 7c | [07c-selective-rewind.md](./07c-selective-rewind.md) | Selective rewind scopes | P1 |
| 8a | [08a-agent-card-discovery.md](./08a-agent-card-discovery.md) | Agent cards + discovery service | P2 |
| 8b | [08b-task-state.md](./08b-task-state.md) | Task state machine + registry | P2 |
| 8c | [08c-sse-protocol.md](./08c-sse-protocol.md) | SSE streaming + message protocol | P2 |
| 9a | [09a-plugin-manifest.md](./09a-plugin-manifest.md) | Plugin manifest + directory layout | P2 |
| 9b | [09b-plugin-integrity-registry.md](./09b-plugin-integrity-registry.md) | Integrity hash + plugin registry | P2 |
| 10a | [10a-pipeline-contracts.md](./10a-pipeline-contracts.md) | 3-phase pipeline + output contracts | P1 |
| 10b | [10b-agent-teams.md](./10b-agent-teams.md) | Agent teams + definitions | P1 |
| 10c | [10c-bounded-loop.md](./10c-bounded-loop.md) | Bounded autonomous loop + cron | P1 |
| 11a | [11a-security-ci.md](./11a-security-ci.md) | Security CI + nightly audit | P2 |
| 11b | [11b-perf-gates-observability.md](./11b-perf-gates-observability.md) | Performance gates + observability | P2 |
| 12a | [12a-repomap.md](./12a-repomap.md) | Structural AST map | P1 |
| 12b | [12b-jit-context.md](./12b-jit-context.md) | JIT context discovery + directives | P1 |

## Priority Legend

- **P0** — Implement immediately; fills critical gaps in the supervisor
- **P1** — Implement soon; significant architectural improvement
- **P2** — Future; valuable but higher complexity or lower urgency

## Source Repo

`docs/analysis/arc-cli/` — cloned from `github.com:Ashutosh0x/arc-cli`

## Key Source Files (Reference)

```
crates/arc-core/src/memory/          — tiered memory, compressor
crates/arc-core/src/compaction.rs    — multi-phase context compaction
crates/arc-plan/src/plan_model.rs    — Plan/PlanStep/DAG schemas
crates/arc-hooks/src/engine.rs       — hook engine, blocking/parallel dispatch
crates/arc-hooks/src/security_presets.rs — default security hooks
crates/arc-tools/src/security/       — sandbox, path guard
crates/arc-policy/src/               — static + Conseca policy engine
crates/arc-providers/src/            — router, circuit breaker, fallback
crates/arc-fork/src/                 — snapshots, fork manager, selective rewind
crates/arc-a2a/src/                  — A2A protocol, task registry, SSE
crates/arc-plugins/src/              — manifest, installer, integrity
crates/arc-agents/src/               — orchestrator, contracts, registry
crates/arc-repomap/src/              — tree-sitter AST extraction
crates/arc-core/src/jit_context.rs   — JIT context discovery
tests/security/                      — command injection, credential, path traversal
tests/integration/                   — hook lifecycle, plugin, fork, loop, remote
benches/                             — performance benchmarks with thresholds
```
