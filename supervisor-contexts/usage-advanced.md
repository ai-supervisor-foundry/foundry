---
description: Boilerplate preparation, state dump/load, and monitoring details
---

# Usage — Advanced Operations

Parent: [usage.md](./usage.md)

## Prepare Code Boilerplates (Optional)

Before starting the supervisor, prepare initial code in the sandbox:

```bash
mkdir -p sandbox/my-project
cp -r my-boilerplate/* sandbox/my-project/
```

**What to include**: project structure, dependencies, starter templates, config files (`.env.example`, `tsconfig.json`), existing codebase if continuing work.

Tasks can reference existing files: "Extend `App.tsx`...", "Add endpoint following pattern in `routes/users.ts`..."

## State Dump & Load

```bash
# Dump state to JSON (debugging/backup)
npm run tsx scripts/dump-state.ts -- \
  --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --output STATE.json

# Load state from JSON (overwrites Redis)
npm run tsx scripts/load-state.ts -- \
  --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --input STATE.json
```

## Monitoring

```bash
# Check status
npm run cli -- status --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --queue-name tasks --queue-db 2

# View audit logs
tail -f sandbox/<project-id>/audit.log.jsonl

# View PM2 logs (always --nostream)
pm2 logs supervisor --nostream
```
