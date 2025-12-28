# Sandbox Directory Location

## Default Location

The sandbox root directory defaults to `./sandbox` relative to the supervisor project root.

## Structure

```
supervisor/                    # Supervisor project root
├── src/
├── docs/
├── sandbox/                   # Sandbox root (default: ./sandbox)
│   ├── project-1/            # Project-specific directory
│   │   ├── audit.log.jsonl   # Project audit logs
│   │   └── ...               # Project files
│   ├── project-2/
│   │   ├── audit.log.jsonl
│   │   └── ...
│   └── default/              # Default project if no project_id
│       ├── audit.log.jsonl
│       └── ...
```

## Configuration

The sandbox root can be configured via CLI option:
```bash
--sandbox-root <path>
```

- Relative path: `./sandbox` or `sandbox` (relative to supervisor project root)
- Absolute path: `/sandbox` or `/var/sandbox` (absolute system path)

## Project Directories

Each project gets its own subdirectory:
- Path: `<sandbox-root>/<project-id>`
- Example: `./sandbox/api-project` or `/sandbox/api-project`
- Contains: project files, audit logs, artifacts

## Audit Logs

Audit logs are written to:
- Path: `<sandbox-root>/<project-id>/audit.log.jsonl`
- Example: `./sandbox/api-project/audit.log.jsonl`

