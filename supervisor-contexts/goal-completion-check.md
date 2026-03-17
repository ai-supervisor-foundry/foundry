---
description: Goal completion evaluation when queue exhausted
---

# Goal Completion Check

When the queue is exhausted and not all goals are completed:

1. Supervisor builds a prompt listing all project goals and completed/blocked tasks, asking the agent if goals are met
2. Agent responds with JSON: `{ "goal_completed": boolean, "reasoning": "string" }`
3. If `goal_completed: true` → Supervisor marks all goals as complete, status becomes `COMPLETED`
4. If `goal_completed: false` → Supervisor halts with agent's reasoning

The check runs against the first registered project's sandbox CWD. All goals in `state.goals` are marked completed together on a positive result.
