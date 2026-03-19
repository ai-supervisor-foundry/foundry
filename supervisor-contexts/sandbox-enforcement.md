---
description: Multi-project sandbox isolation rules and path enforcement
---

# Sandbox Enforcement

## Multi-Project Rules

Each app/project:
- Has its own directory
- Has its own state key
- Has its own task queue

## Supervisor Enforcement

- **No cross-project file access**
- **No shared state**
- Agent process is spawned with `cwd` set to `<sandbox-root>/<project-id>` (or `working_directory` override); `sandbox_root` is also injected into the state snapshot context

## Sandbox Location

- Default sandbox root: `./sandbox` (relative to supervisor project root)
- Project directory: `<sandbox-root>/<project-id>`
- Task-level override: `<sandbox-root>/<working_directory>` (if specified in task)
- Example: `./sandbox/api-project` or `/sandbox/api-project` (if absolute path provided)

## Working with Existing Code

The supervisor is designed to **work with existing codebases and boilerplates**:

- **Boilerplates**: Place starter code in `sandbox/<project-id>/` before starting
- **Existing Projects**: Point supervisor to existing project directories
- **Incremental Development**: Tasks can extend, modify, or build upon existing files
- **Code Context**: The supervisor's agent (Cursor CLI) has full access to all files in the sandbox directory
- **File References**: Tasks can explicitly reference existing files in instructions

**Example Task Instructions**:
```
"Extend the existing App.tsx component to add user authentication. 
The component is located at src/App.tsx and uses React Router. 
Follow the existing code style and patterns."
```

## Violations

- Any violation → task invalid
