---
description: Directory layout for sandbox project isolation
---

# Sandbox Structure

```
supervisor/
├── sandbox/              # Sandbox root (default: ./sandbox)
│   ├── project-1/        # Project-specific directory
│   │   ├── audit.log.jsonl
│   │   ├── logs/
│   │   │   └── prompts.log.jsonl
│   │   ├── src/          # Your boilerplate/initial code
│   │   ├── package.json   # Dependencies, scripts
│   │   ├── tsconfig.json # Configuration files
│   │   └── ...           # All project files
│   └── project-2/
│       └── ...
```

**Key Points**:
- Place your **code boilerplates** in `sandbox/<project-id>/` before starting
- The supervisor will **work with and build upon** existing files
- All project files, logs, and artifacts are contained within the project directory
- Tasks execute in this directory context, so they can reference existing files

## Task-to-Project Assignment

- Tasks are assigned to projects via `task.project_id` (required field).
- CWD for agent execution resolves to `sandbox/{task.project_id}/`.
- Monolith projects can have FE/BE subdirectories; subdirectory targeting is done via task instructions (not CWD).
- Project registry is managed via UI or Redis (`supervisor:projects` hash).
