---
title: DragonflyDB Underuse Analysis, Pub/Sub Event Bus & Postgres Replication
date: 2026-03-20
status: Proposed
priority: High
---

# DragonflyDB Underuse Analysis, Pub/Sub Event Bus & Postgres Replication

## 1. Current DragonflyDB Underuse

**Running version:** DragonflyDB v1.35.1 — supports pub/sub, streams, Lua, hashes, sorted sets.
**Current usage:** 10 commands (`GET`, `SET`, `SETEX`, `LPUSH`, `RPOP`, `LLEN`, `LRANGE`, `DEL`, `PIPELINE`, `QUIT`).

> **`supervisor-contexts/dragonflydb-constraints.md` is outdated.** It claims no pub/sub, no Lua, no clustering — all false for v1.35.1. Must be updated before any work begins.

### What's Available vs. What's Used

| Feature | Current | Available & Useful |
|---|---|---|
| **State** | Single JSON blob (`GET`/`SET`) | **Hashes** (`HSET`/`HGET`) — granular field updates without full blob read/write |
| **Queue** | Lists (`LPUSH`/`RPOP`) | **Streams** (`XADD`/`XREAD`) — consumer groups, acknowledgment, replay, backpressure |
| **Events** | IPC via `child_process` fork | **Pub/Sub** (`PUBLISH`/`SUBSCRIBE`) — decouple workers, UI, external consumers |
| **Metrics** | File-based JSONL + PM2 logs | **Sorted Sets** (`ZADD`/`ZRANGEBYSCORE`) — time-series metrics with score=timestamp |
| **Dependency resolution** | Client-side `LRANGE` + rebuild | **Lua scripting** (`EVAL`) — atomic dependency promotion in-server, zero round-trips |
| **Task dedup** | None | **Sets** (`SADD`/`SISMEMBER`) — track completed task IDs for O(1) dependency lookup |
| **Audit index** | File-only, no queryable index | **Streams** — append-only log with built-in ID ordering + `XRANGE` queries |

### Specific Underuse Areas

**A. Atomic blob is the biggest bottleneck.**
Every state update serializes and writes the *entire* state including `completed_tasks[]` which grows unboundedly. With hashes:
```
HSET supervisor:state supervisor '{"status":"RUNNING","iteration":42}'
HSET supervisor:state goals '{"proj1":{"completed":false}}'
HSET supervisor:state active_tasks '{...}'
```
Read one field: `HGET supervisor:state active_tasks` — no need to parse the full blob.

**B. Dependency promotion is expensive.**
`promoteReadyTasks()` does `LRANGE` (read all waiting) → client-side filter → `DEL` + `LPUSH` pipeline. With a Lua script + a Set of completed task IDs, this becomes a single atomic server-side operation.

**C. No real-time event bus.**
Workers communicate via IPC (`process.send`), which only works for parent-child processes. The UI dashboard has to poll. Pub/Sub would let the UI, workers, and external tools (Postgres replicator, Slack notifier) all subscribe independently.

**D. Validation cache has no invalidation strategy.**
Uses `SETEX` with 1-hour TTL, but if the underlying files change, stale results persist for up to an hour.

---

## 2. What We Should Be Doing Better

### High-Impact Improvements (Priority Order)

**1. Replace atomic blob with Hash-per-section**
- Split state into `HSET` fields: `supervisor`, `goals`, `active_tasks`, `completed_tasks`, `queue`, `file_locks`
- Granular reads/writes eliminate serialization bottleneck
- `completed_tasks` can move to a Stream (append-only, bounded via `XTRIM`)

**2. Use Streams instead of Lists for the task queue**
- Consumer groups give: message acknowledgment, pending entry tracking, automatic redelivery on crash
- `XREADGROUP` replaces the manual "re-enqueue on crash" recovery logic
- `XPENDING` shows which tasks are stuck — observable without extra code
- Built-in backpressure via `BLOCK` + `COUNT`

**3. Use a Set for completed task IDs**
- `SADD completed_tasks task_123` — O(1)
- `SISMEMBER completed_tasks dep_task_id` — O(1) dependency check
- Current approach: linear scan through `completed_tasks[]` array in the JSON blob

**4. Move audit log indexing to DragonflyDB**
- Keep JSONL files as the authoritative audit trail
- Add a Stream (`XADD audit:proj1 * event TASK_COMPLETED task_id t123 ...`) for queryable indexing
- `XRANGE audit:proj1 - +` for time-range queries without parsing JSONL

**5. Add session/iteration metrics via Sorted Sets**
- `ZADD metrics:iteration_duration <timestamp> <duration_ms>`
- `ZRANGEBYSCORE` for time-windowed queries
- Feeds the observability gap identified in `session-metrics-and-observability.md`

**6. Update `dragonflydb-constraints.md`**
- Remove false claims about pub/sub, Lua, and clustering limitations

---

## 3. Internal Pub/Sub for Replication to Postgres

### Architecture

```
┌─────────────┐     PUBLISH      ┌──────────────┐     INSERT/UPSERT    ┌──────────┐
│ Supervisor   │ ──────────────→ │  Replicator   │ ──────────────────→ │ Postgres │
│ (state write)│                 │  (subscriber) │                     │          │
└─────────────┘                  └──────────────┘                      └──────────┘
       │                                │
       │  PUBLISH                       │  also receives:
       ▼                                ▼
┌─────────────┐               ┌──────────────┐
│ UI Dashboard │               │ Task events  │
│ (subscriber) │               │ Audit events │
└─────────────┘               │ Metric events│
                              └──────────────┘
```

### Channel Design

| Channel | Published When | Payload |
|---|---|---|
| `sv:state:<project_id>` | After every `persistState()` | Changed fields only (delta) |
| `sv:task:completed` | Task completes validation | `{task_id, project_id, validation_report, completed_at}` |
| `sv:task:blocked` | Task blocks | `{task_id, reason, blocked_at}` |
| `sv:task:dispatched` | Worker picks up task | `{task_id, worker_id, started_at}` |
| `sv:audit` | Every audit log entry | Full audit entry (same as JSONL) |
| `sv:metrics` | Per-iteration | `{iteration, duration_ms, tasks_completed, provider}` |
| `sv:halt` | Supervisor halts | `{reason, iteration, timestamp}` |

### Postgres Schema (Target)

```sql
-- Hot state (mirrors DragonflyDB, queryable)
CREATE TABLE supervisor_state (
  project_id    TEXT PRIMARY KEY,
  status        TEXT NOT NULL,
  iteration     INT NOT NULL,
  goals         JSONB,
  active_tasks  JSONB,
  queue_status  JSONB,
  updated_at    TIMESTAMPTZ NOT NULL
);

-- Append-only history (what DragonflyDB can't do well)
CREATE TABLE task_history (
  id              SERIAL PRIMARY KEY,
  task_id         TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  event           TEXT NOT NULL,  -- dispatched, completed, blocked, failed
  payload         JSONB,
  validation      JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_task_history_project ON task_history(project_id, created_at);

-- Audit trail (replaces/supplements JSONL)
CREATE TABLE audit_log (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL,
  iteration       INT,
  event           TEXT NOT NULL,
  task_id         TEXT,
  state_diff      JSONB,
  validation      JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_project ON audit_log(project_id, created_at);

-- Metrics (time-series, for dashboards)
CREATE TABLE iteration_metrics (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL,
  iteration       INT NOT NULL,
  duration_ms     INT,
  provider        TEXT,
  tasks_completed INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Replicator Service Design

A standalone Node.js process (PM2-managed alongside supervisor):

```
replicator/
  index.ts          — Subscribe to sv:* channels, batch-write to Postgres
  pgWriter.ts       — Connection pool + upsert/insert logic
  batchBuffer.ts    — Buffer events, flush every N events or M ms
  config.ts         — PG connection string, batch size, flush interval
```

**Key principles:**
- **Fire-and-forget from supervisor's perspective** — `PUBLISH` is non-blocking, doesn't wait for Postgres
- **Batch writes** — buffer 10-50 events before flushing to Postgres (reduces write amplification)
- **Idempotent inserts** — use `ON CONFLICT DO UPDATE` for state, plain `INSERT` for history/audit
- **Backpressure** — if Postgres is slow, buffer grows in memory (bounded, drop oldest on overflow)
- **Separate process** — Postgres latency never affects supervisor loop timing
- **DragonflyDB remains source of truth** — Postgres is a read replica for queries, dashboards, and historical analysis

### Integration Points (Existing Code)

Only two files need modification to publish events:

1. **`src/application/services/persistence.ts`** — After `SET`, publish delta:
   ```typescript
   await this.client.publish(`sv:state:${projectId}`, JSON.stringify(delta));
   ```

2. **`src/infrastructure/adapters/logging/auditLogger.ts`** — After file append, publish:
   ```typescript
   await this.pubClient.publish('sv:audit', JSON.stringify(entry));
   ```

Task events and metrics hook into `src/controlLoop.ts` event points that already exist for logging.

### What This Unlocks

- **Historical queries** that DragonflyDB can't answer ("show me all blocked tasks from last week")
- **Dashboard without polling** — UI subscribes to pub/sub channels directly via WebSocket bridge
- **External integrations** — Slack notifications, Grafana dashboards, CI/CD triggers all just subscribe to channels
- **Crash forensics** — Postgres retains full history even if DragonflyDB is wiped
- **Multi-project analytics** — Cross-project queries impossible with per-project JSONL files

---

## Implementation Phases

### Phase 1: Foundations (Pre-requisite)
- Update `supervisor-contexts/dragonflydb-constraints.md` to reflect v1.35.1 capabilities
- Add `pg` / `postgres` dependency to `package.json`

### Phase 2: Pub/Sub Event Bus
- Add `PUBLISH` calls to `persistence.ts` and `auditLogger.ts`
- Create `sv:*` channel convention
- Update UI backend to subscribe instead of poll

### Phase 3: Postgres Replicator
- Create `replicator/` service with PM2 config
- Implement batch buffer + pgWriter
- Run migrations for Postgres schema

### Phase 4: DragonflyDB Data Structure Upgrades
- Migrate state from blob to Hash
- Migrate queue from Lists to Streams with consumer groups
- Add completed task ID Set for O(1) dependency lookup
- Migrate dependency promotion to Lua script

---

## Files Affected

| File | Change |
|---|---|
| `supervisor-contexts/dragonflydb-constraints.md` | Update to reflect actual v1.35.1 capabilities |
| `src/application/services/persistence.ts` | Add `PUBLISH` after state writes; eventually migrate to `HSET`/`HGET` |
| `src/infrastructure/adapters/logging/auditLogger.ts` | Add `PUBLISH` after audit log append |
| `src/domain/executors/taskQueue.ts` | Eventually migrate to Streams + consumer groups |
| `src/application/services/scheduler/index.ts` | Publish task dispatch events |
| `src/controlLoop.ts` | Publish iteration metrics |
| `replicator/` (new) | Standalone Postgres replication service |
| `package.json` | Add `pg` dependency |
| `ecosystem.config.js` | Add replicator PM2 process |
