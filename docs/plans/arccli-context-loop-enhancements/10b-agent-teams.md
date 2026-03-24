# 10b — Agent Teams & Definitions

## Source Files
- `crates/arc-core/src/agent_defs.rs` — AgentDefinition frontmatter
- `crates/arc-core/src/agent_teams.rs` — AgentTeam, roles, messaging
- `crates/arc-agents/src/registry.rs` — Built-in agent profiles

## Agent Definition Schema (.md with YAML frontmatter)

```yaml
---
name: reviewer
description: Code review specialist
model: claude-sonnet
tools: [read, grep, glob]
color: blue
effort: medium
background: false
isolation: none
---

You are a code reviewer focused on...
```

Fields: `name`, `description`, `tools[]`, `model`, `color`, `effort`,
`background`, `isolation` (none/worktree/process), `memory`.
Markdown body = system prompt instructions.

## Agent Teams

```typescript
type AgentRole = 'leader' | 'teammate' | 'background';
type AgentStatus = 'idle' | 'working' | 'waiting' | 'completed' | 'failed' | 'killed';
type IsolationMode = 'none' | 'worktree' | 'process';

interface TeamAgent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  isolation: IsolationMode;
}

interface TeamMessage {
  from: string;
  to: string;
  content: string;
  timestamp: Date;
}
```

## Three Execution Modes

1. **delegate(task, agentName)** — single task to one agent, sequential
2. **mapParallel(tasks, agentName)** — N tasks via `Promise.all()`
3. **executePipeline(task)** — Plan → Architect → Code (see 10a)

## Built-In Agent Capabilities

```typescript
type AgentCapability = 'code_review' | 'testing' | 'security_audit'
  | 'database_design' | 'frontend_design' | 'devops' | 'documentation';
```

## Agent Heuristics (Injected into Every Prompt)

1. If modifying >2 files → use repomap AST indexer for context
2. Surgical editing only — no full file rewrites, use search/replace
3. Agent-to-agent debates capped at 200 words

## SubAgent Result

```typescript
interface SubAgentResult {
  agentId: string;
  task: string;
  output: string;
  executionTimeMs: number;
}
```

## Acceptance Criteria

- [ ] Agent definitions parsed from YAML frontmatter markdown
- [ ] Three execution modes: delegate, mapParallel, executePipeline
- [ ] Agent teams with roles, status tracking, inter-agent messaging
- [ ] Heuristics injected into agent system prompts
