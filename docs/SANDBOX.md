# Sandbox Enforcement

## Multi-Project Rules

- Each app/project:
  - has its own directory
  - has its own state key
  - has its own task queue

## Supervisor Enforcement

- No cross-project file access
- No shared state
- Cursor task prompts must specify: `WORKING DIRECTORY: <sandbox-root>/<project>`

## Sandbox Location

- Default sandbox root: `./sandbox` (relative to supervisor project root)
- Project directory: `<sandbox-root>/<project-id>`
- Example: `./sandbox/api-project` or `/sandbox/api-project` (if absolute path provided)

## Violations

- Any violation → task invalid

