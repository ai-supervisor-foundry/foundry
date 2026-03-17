---
description: PM2 daemon configuration and lifecycle management
---

# PM2 Integration

The supervisor can be run as a daemon using PM2 so it survives terminal close and restarts on crash.

## Basic usage

```bash
# Start supervisor with PM2 (npm)
pm2 start npm --name supervisor -- run cli -- start --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2

# With pnpm
pm2 start pnpm --name supervisor -- run cli -- start --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2
```

## Logs and process control

```bash
# View logs (streaming)
pm2 logs supervisor

# View logs without streaming (historical only)
pm2 logs supervisor --nostream

# List processes and status
pm2 list

# Stop supervisor
pm2 stop supervisor

# Restart supervisor
pm2 restart supervisor

# Remove from PM2
pm2 delete supervisor
```

## Ecosystem file (optional)

For a single config that defines the supervisor (and any other apps), use an `ecosystem.config.cjs` at the project root and start with:

```bash
pm2 start ecosystem.config.cjs
```

Example app entry (env and args must match your Redis and queue settings):

```javascript
{
  name: "supervisor",
  cwd: "/path/to/project",
  script: "pnpm",
  args: ["run", "cli", "--", "start", "--redis-host", "localhost", "--redis-port", "6499", "--state-key", "supervisor:state", "--queue-name", "tasks", "--queue-db", "2"],
  env: { NODE_ENV: "development" },
  autorestart: true,
  watch: false,
}
```

See [configuration.md](./configuration.md) for all CLI options and environment variables.
