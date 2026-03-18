# V2 Module: Hybrid Memory Strategy

**Status:** Planned
**Priority:** Low (Phase 4)
**Inspiration:** `claude-flow`'s Dual-Layer fallback.

## 1. Overview
Foundry currently requires a running Redis (DragonflyDB) instance. This creates friction for new users ("I just want to run a script, why do I need Docker?").

V2 introduces a **Hybrid Persistence Layer** that prioritizes Redis for performance (Locks, Queues) but maintains a robust `state.json` fallback for portability and ease of use.

## 2. Architecture

### The Persistence Adapter
We abstract storage behind a unified interface:

```typescript
interface PersistenceAdapter {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  lock(resource: string): Promise<LockHandle>;
}
```

### Mode A: Enterprise (Default)
- **Primary:** DragonflyDB (Redis).
- **Behavior:** All reads/writes go to Redis.
- **Backup:** Async snapshots to `state.json` every 60s (for inspection/backup).

### Mode B: Portable (Fallback)
- **Primary:** `state.json` (File System).
- **Behavior:**
    - Queues are emulated in-memory (Node.js Array).
    - Locks are file-based (`.lock`).
- **Use Case:** Quick scripts, CI/CD without Redis, Local testing.

## 3. Architecture Decision Record (ADR): Rejecting Vector Memory

**Context:** Competitors (`claude-flow`) use "AgentDB" (Vector Search) to give agents "Long-Term Memory" of code snippets.

**Decision:** We explicitly **REJECT** Vector Memory for Foundry V2.

**Reasoning:**
1.  **Stale Context:** Code changes rapidly. Retrieving a vector embedding from 3 days ago creates "Ghost Code" hallucinations (referencing functions that no longer exist).
2.  **Determinism:** Foundry prioritizes *Ground Truth*. We prefer `grep` and `ls` (checking the *actual* state) over fuzzy semantic retrieval.
3.  **Complexity:** Maintaining a Vector DB adds massive overhead for marginal gain in a coding context.

**Alternative:**
- Use **Codebase Investigation** (Map generation) for high-level context.
- Use **Fresh File Reads** for low-level context.

## 4. Implementation Plan

### Step 1: Abstract Persistence
- [ ] Refactor direct Redis calls in `Supervisor` to `PersistenceService`.

### Step 2: Implement FileAdapter
- [ ] Create `FilePersistenceAdapter`.
- [ ] Implement `FileLock` (using `proper-lockfile`).

### Step 3: Auto-Discovery
- [ ] On startup: Check for Redis connection.
- [ ] If fail: Warn user, fallback to `FilePersistenceAdapter`.
