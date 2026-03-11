# Installation & Setup

## Prerequisites

- **Node.js**: LTS version (install via [nvm](https://github.com/nvm-sh/nvm))
- **Docker & Docker Compose**: For running DragonflyDB
- **Cursor CLI**: Install `cursor` command (see [Cursor CLI docs](https://cursor.com/cli))
- **Optional**: Claude CLI, Gemini CLI, Codex CLI, OpenRouter API key

## Install Dependencies

```bash
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
