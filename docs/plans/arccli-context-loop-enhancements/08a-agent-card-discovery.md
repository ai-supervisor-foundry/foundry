# 08a — Agent Cards & Discovery Service

## Source Files
- `crates/arc-a2a/src/protocol.rs` — AgentCard, AgentSkill, AuthScheme
- `crates/arc-a2a/src/discovery.rs` — DiscoveryService with TTL cache
- `crates/arc-a2a/src/auth.rs` — JWT + HMAC-SHA256

## Agent Card (served at `GET /.well-known/agent.json`)

```typescript
interface AgentCard {
  agentId: string;
  name: string;
  description: string;
  endpoint: string;
  protocolVersion: { major: number; minor: number };
  skills: AgentSkill[];
  authSchemes: AuthScheme[];
  maxConcurrentTasks: number;
  supportsStreaming: boolean;
  updatedAt: string;
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  inputSchema?: object;        // JSON Schema
  tags: string[];
}

type AuthScheme =
  | { type: 'none' }
  | { type: 'bearer'; tokenUrl: string }
  | { type: 'hmac_sha256'; headerName: string }
  | { type: 'api_key'; headerName: string };
```

## Discovery Service

```typescript
class DiscoveryService {
  private cache = new Map<string, { card: AgentCard; expiresAt: number }>();
  private cacheTtlMs = 300_000;   // 5 minutes

  async discover(endpoint: string): Promise<AgentCard> {
    const cached = this.cache.get(endpoint);
    if (cached && cached.expiresAt > Date.now()) return cached.card;

    const res = await fetch(`${endpoint}/.well-known/agent.json`);
    const card: AgentCard = await res.json();

    // Validate: non-empty agentId, endpoint, compatible major version
    this.cache.set(endpoint, {
      card,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return card;
  }

  supportsSkill(endpoint: string, skillId: string): boolean { }
  findSkillsByTag(endpoint: string, tag: string): AgentSkill[] { }
}
```

## Authentication

- **HMAC-SHA256**: Sign message body with shared secret, include in header
- **JWT**: Short-lived tokens (60s) with scopes: `task:submit`, `task:query`

## HTTP Routes

```
GET  /.well-known/agent.json        → AgentCard
POST /a2a/messages                   → Accept task / handle message
GET  /a2a/tasks/:id                  → Task status
POST /a2a/tasks/:id/cancel           → Cancel task
GET  /a2a/tasks/:id/stream           → SSE progress stream
GET  /a2a/health                     → Health check
```

## Acceptance Criteria

- [ ] AgentCard served at well-known URL
- [ ] Discovery service fetches + caches with TTL
- [ ] Skill validation before accepting tasks (404 if unsupported)
- [ ] HMAC-SHA256 or JWT authentication middleware
