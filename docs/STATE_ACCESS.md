# State Access

- Supervisor loads state at loop start.
- State is immutable during task execution.
- Validation must complete before mutation.
- Only the supervisor writes state.
- Tools (including Cursor CLI) do not access state directly. The supervisor injects the required state context into each task prompt.
- State snapshots are injected into task prompts explicitly.

## State Snapshot Rules

- Inject only the minimal required subset of state.
- Never inject the full raw state unless explicitly required.
- Clearly label injected state as: `READ-ONLY CONTEXT — DO NOT MODIFY`
- Cursor output attempting to mutate state directly is invalid.

## State Management Scripts

For debugging and migration, scripts are provided to dump and load the supervisor state to/from a local JSON file.

### Dump State (Redis -> JSON)

Extracts the current state from Redis and saves it to a local JSON file.

```bash
npm run tsx scripts/dump-state.ts -- \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --output STATE.json
```

### Load State (JSON -> Redis)

Reads a local JSON state file and overwrites the state in Redis.

**WARNING:** This operation completely overwrites the existing state in Redis.

```bash
npm run tsx scripts/load-state.ts -- \
  --redis-host localhost \
  --redis-port 6499 \
  --state-key supervisor:state \
  --input STATE.json
```

