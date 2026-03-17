---
description: Prerequisites, DragonflyDB setup, and npm installation
---

# Installation & Setup

## Prerequisites

- **Node.js**: LTS version (install via [nvm](https://github.com/nvm-sh/nvm))
- **Package manager**: Use **pnpm** (recommended for this workspace) or npm
- **Docker & Docker Compose**: For running DragonflyDB
- **Cursor CLI**: Install `cursor` command (see [Cursor CLI docs](https://cursor.com/cli))
- **Optional**: Claude CLI, Gemini CLI, Codex CLI, OpenRouter API key

## Install Dependencies

From the project root:

```bash
# With pnpm (recommended)
pnpm install
pnpm run build

# Or with npm
npm install
npm run build
```

## Infrastructure Setup

1. **Start DragonflyDB**:
   ```bash
   docker-compose up -d
   ```

2. **Verify DragonflyDB is running**:
   ```bash
   docker ps | grep dragonflydb
   redis-cli -h localhost -p 6499 ping  # Should return: PONG
   ```

   Default port is **6499**. If you use a different host/port, pass `--redis-host` and `--redis-port` to every CLI command (see [configuration.md](./configuration.md)).

## Next steps

- **Configure** env vars and CLI options: [configuration.md](./configuration.md)
- **Run the workflow** (init → set-goal → enqueue → start): [usage.md](./usage.md)
- **Run as a daemon** with PM2: [pm2-integration.md](./pm2-integration.md)
