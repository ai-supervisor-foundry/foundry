---
description: Directory structure and usage guide for supervisor-contexts
---

# Supervisor Contexts

System documentation for the Foundry supervisor.
This directory provides all documentation for the Supervisor system.

- **Docs:** [Introduction](https://ai-supervisor-foundry.github.io/site/docs/introduction)
- **Wiki:** [Overview](https://ai-supervisor-foundry.github.io/site/wiki/overview)
- **Index:** [CONTEXT.md](./CONTEXT.md)
- **Concepts:** [Overview](./overview.md), [Core Principles](./core-principles.md), [Architecture](./architecture.md)
- **Getting Started:** [Installation & Setup](./installation-setup.md), [Usage](./usage.md)
- **Operation:** [Configuration](./configuration.md), [PM2 Integration](./pm2-integration.md), [Recovery Actions](./recovery-actions.md)

## Structure

- `CONTEXT.md` — Master index (read first)
- `windows/` — Sliding window of recent context files (manually maintained)
- Section files — One topic per file (overview, architecture, validation, etc.)

## Usage

1. **Start**: Read `CONTEXT.md` for the full index
2. **Deep dive**: Read specific section files as needed
3. **Recent changes**: Check `windows/` for updates

## For Project Tasks

Use `contexts/<project-name>/` instead — supervisor-contexts is for the supervisor system itself.

## Maintenance

- Update section files when core system changes
- Window files: manually maintained, max 10, rotate oldest out
- Naming: `context-YYYY-MM-DD-NNN.md` or `context-NNN.md`
