# State Setup

1. Operator starts DragonflyDB via docker-compose.
2. Operator initializes supervisor state key from chat prompt/instructions.
3. execution_mode is set to "AUTO".
4. goal is injected explicitly from operator instructions.
5. Supervisor loop may begin.

## No Hidden Defaults

- Avoid implicit defaults
- Fail fast on missing config
- Require explicit operator input for:
  - execution_mode
  - state key
  - sandbox root
  - queue name
- Silence is treated as misconfiguration

