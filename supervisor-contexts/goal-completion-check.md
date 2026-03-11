# Goal Completion Check

When the queue is exhausted and the goal is not completed:

1. Supervisor builds a prompt asking the agent if the goal is met
2. Agent responds with JSON: `{ "goal_completed": boolean, "reasoning": "string" }`
3. If `goal_completed: true` → Supervisor marks goal as complete, status becomes `COMPLETED`
4. If `goal_completed: false` → Supervisor halts with agent's reasoning
