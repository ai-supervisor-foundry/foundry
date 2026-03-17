---
description: CLI workflow — init, set-goal, enqueue, start, monitor, halt/resume
---

# Usage

## Workflow

1. Prepare boilerplates in `sandbox/<project-id>/` (optional)
2. Initialize state → 3. Set goal(s) → 4. Enqueue tasks → 5. Start supervisor

## Commands

```bash
# 1. Init state
npm run cli -- init-state --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --queue-name tasks --queue-db 2 --execution-mode AUTO

# 2. Set goal (repeat per project)
npm run cli -- set-goal --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --queue-name tasks --queue-db 2 \
  --project-id my-project --description "Goal description"

# 3. Enqueue tasks
npm run cli -- enqueue --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --queue-name tasks --queue-db 2 \
  --task-file tasks/tasks.json

# 4. Start
npm run cli -- start --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --queue-name tasks --queue-db 2

# 5. Monitor
npm run cli -- status --redis-host localhost --redis-port 6499 \
  --state-key supervisor:state --queue-name tasks --queue-db 2
pm2 logs supervisor --nostream

# Halt / Resume
npm run cli -- halt ... --reason "Operator intervention"
npm run cli -- resume ...
```

Advanced operations (boilerplates, state dump/load, monitoring): [usage-advanced.md](./usage-advanced.md)

## Parallel Task Fields

- `affects_files` (required): Files task modifies — used for file-level locking
- `depends_on` (optional): Task IDs that must complete first — auto-promoted when deps met
