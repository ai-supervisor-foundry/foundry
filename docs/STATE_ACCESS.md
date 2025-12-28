# State Access

- Supervisor loads state at loop start.
- State is immutable during task execution.
- Validation must complete before mutation.
- Only the supervisor writes state.
- Tools (including Cursor CLI) do not access state directly. The supervisor injects the required state context into each task prompt.
- State snapshots are injected into task prompts explicitly.

## State Snapshot Rules

- Inject only the minimal required subset of state.
- Never inject the full raw state unless explicitly required.
- Clearly label injected state as: `READ-ONLY CONTEXT — DO NOT MODIFY`
- Cursor output attempting to mutate state directly is invalid.

