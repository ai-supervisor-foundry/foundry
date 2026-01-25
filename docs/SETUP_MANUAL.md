# Manual Setup & Infrastructure Guide

This guide is for power users who prefer to configure Foundry manually or need to run it in specialized environments (CI/CD, remote servers without interactive shells).

---

## 1. Infrastructure Setup

Foundry requires **DragonflyDB** (Redis-compatible) for state and **Ollama** (optional) for local validation.

### Using Docker Compose
```bash
# Start DragonflyDB and Ollama
docker-compose up -d

# Verify containers
docker ps
```

### Manual Config
If not using Docker, ensure a Redis-compatible database is running on port `6499`.

---

## 2. Manual Provider Authentication

If you skip `npm run setup`, you must authenticate providers via their respective CLIs:

### Google Gemini
```bash
npx @google/gemini-cli login
# Or set GOOGLE_API_KEY in your .env
```

### GitHub Copilot
```bash
npx @github/copilot auth
```

### Anthropic Claude
```bash
npx @anthropic-ai/claude-code login
# Or set ANTHROPIC_API_KEY in your .env
```

---

## 3. Advanced Configuration

### Environment Variables (.env)

| Variable | Description | Default | 
| :--- | :--- | :--- |
| `REDIS_HOST` | DragonflyDB/Redis Host | `localhost` |
| `REDIS_PORT` | DragonflyDB/Redis Port | `6499` |
| `HELPER_AGENT_MODE` | Helper Agent Mode (`auto`/`manual`) | `auto` |
| `USE_LOCAL_HELPER_AGENT` | Use local Ollama for validation | `true` |

### Global CLI Flags
All manual commands support these flags:
- `--redis-host`: Defaults to `localhost`
- `--redis-port`: Defaults to `6499`
- `--state-key`: Key for persistence (e.g., `supervisor:state`)
- `--queue-name`: Task queue name (e.g., `tasks`)
