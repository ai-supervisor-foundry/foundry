# 02 — Takeover Backend

## Architecture

```
[Frontend]  ←WebSocket→  [UI Backend]  ←Redis PubSub→  [Supervisor]
   (chat)                  (relay)                       (control loop)
```

## WebSocket Server

Add `socket.io` to UI backend for real-time bidirectional communication.

```typescript
// UI/backend/src/services/takeoverService.ts

interface TakeoverSession {
  taskId: string;
  projectId: string;
  killedAt: string;
  operatorId: string;
  status: 'active' | 'ended';
  executionLogs: string; // What the agent did before kill
  messages: TakeoverMessage[];
}

interface TakeoverMessage {
  role: 'operator' | 'system';
  content: string;
  timestamp: string;
}
```

## REST Endpoints

```
POST /api/takeover/start         — Initiate takeover for a task
  { taskId }
  Response: { success, session, executionLogs }

POST /api/takeover/end           — End takeover (resume/rerun/complete/abort)
  { taskId, action, operatorMessage }
  Response: { success, taskUpdated }

GET  /api/takeover/:taskId       — Get takeover session + messages
  Response: { session, messages, taskContext }
```

## WebSocket Events

```typescript
// Client → Server
emit('takeover:join', { taskId })
emit('takeover:message', { taskId, content })
emit('takeover:action', { taskId, action: 'resume' | 'rerun' | 'complete' | 'abort' })

// Server → Client
on('takeover:started', { session, executionLogs })
on('takeover:ended', { result })
on('takeover:error', { error })
```

## Takeover Flow

### 1. Operator clicks "Take Over"

```
POST /api/takeover/start { taskId: "fix-login-bug" }
  ↓
UI Backend:
  ├─ Fetch active_tasks[taskId] from Redis
  ├─ Validate task is RUNNING
  ├─ Publish to Redis: takeover:{taskId}:commands → { type: 'KILL' }
  ├─ Create TakeoverSession in memory
  ├─ Update state: active_tasks[taskId].status = 'TAKEOVER'
  └─ Return { session, executionLogs }

Supervisor (via Redis PubSub listener):
  ├─ Receives KILL command
  ├─ Kill child process: childProcess.kill('SIGTERM')
  ├─ Capture execution logs (last N lines from agent output)
  ├─ Publish to Redis: takeover:{taskId}:events → { type: 'KILLED', logs }
  └─ Enter takeover event loop
```

### 2. Operator sends message

```
WebSocket: emit('takeover:message', { taskId, content })
  ↓
UI Backend:
  ├─ Store message in TakeoverSession
  ├─ Publish to Redis: takeover:{taskId}:messages → { role: 'operator', content }
  ├─ Broadcast to WS: updated message list
  └─ Acknowledge to client

Supervisor (listening on takeover channel):
  ├─ Receives operator message
  ├─ Append to task's existing messages/context
  └─ Keep in memory (for Resume action)
```

### 3. Operator clicks "Resume"

```
emit('takeover:action', { taskId, action: 'resume' })
  ↓
UI Backend:
  ├─ POST /api/takeover/end { taskId, action: 'resume' }
  ├─ Publish to Redis: takeover:{taskId}:commands → { type: 'RESUME' }
  └─ Close takeover session

Supervisor:
  ├─ Receives RESUME
  ├─ Update task context: append operator messages to instructions
  ├─ Set status back to RUNNING
  ├─ Resume control loop (execute the same task again with updated context)
  └─ Publish: takeover:{taskId}:events → { type: 'RESUMED' }
```

### 4. Operator clicks "Rerun"

```
emit('takeover:action', { taskId, action: 'rerun' })
  ↓
UI Backend:
  ├─ Publish to Redis: takeover:{taskId}:commands → { type: 'RERUN' }
  └─ Close takeover session

Supervisor:
  ├─ Receives RERUN
  ├─ Reset task to `pending` state
  ├─ Append operator message as new instructions: "Focus on: ..."
  ├─ Re-enqueue task to front of queue
  ├─ Set status back to RUNNING
  ├─ Resume control loop (will pick up re-enqueued task)
  └─ Publish: takeover:{taskId}:events → { type: 'REQUEUED' }
```

### 5. Operator clicks "Complete" or "Abort"

```
emit('takeover:action', { taskId, action: 'complete' | 'abort', notes })
  ↓
UI Backend:
  ├─ Publish to Redis: takeover:{taskId}:commands → { type: action, notes }
  └─ Close takeover session

Supervisor:
  ├─ Receives action
  ├─ If 'complete': set task.status = 'COMPLETED', task.result = notes
  ├─ If 'abort': set task.status = 'BLOCKED', task.blockedReason = notes
  ├─ Set supervisor.status back to RUNNING (or HALTED if was halted before)
  ├─ Resume control loop
  └─ Publish: takeover:{taskId}:events → { type: 'ENDED' }
```

## Redis PubSub Channels

```
takeover:{taskId}:commands    ← UI backend sends commands (KILL, RESUME, RERUN, COMPLETE, ABORT)
takeover:{taskId}:events      ← Supervisor publishes events (KILLED, RESUMED, REQUEUED, ENDED, ERROR)
takeover:{taskId}:messages    ← Messages exchanged during takeover (for audit trail)
```

## Supervisor-Side Integration

New module: `src/application/services/controlLoop/modules/takeoverHandler.ts`

```typescript
export class TakeoverHandler {
  private redisClient: RedisClient;
  private killedProcesses: Map<string, { timestamp: Date; logs: string }> = new Map();

  // Subscribe to takeover commands for active task
  async handleTakeoverCommands(taskId: string, activeTask: Task): Promise<void> {
    const sub = this.redisClient.duplicate();
    await sub.subscribe(`takeover:${taskId}:commands`);

    sub.on('message', async (channel, message) => {
      const cmd = JSON.parse(message);

      switch (cmd.type) {
        case 'KILL':
          await this.killTaskProcess(taskId, activeTask);
          break;
        case 'RESUME':
          await this.resumeTask(taskId, activeTask);
          break;
        case 'RERUN':
          await this.rerunTask(taskId, activeTask);
          break;
        case 'COMPLETE':
          await this.completeTask(taskId, activeTask, cmd.notes);
          break;
        case 'ABORT':
          await this.abortTask(taskId, activeTask, cmd.notes);
          break;
      }

      if (['RESUME', 'RERUN', 'COMPLETE', 'ABORT'].includes(cmd.type)) {
        await sub.unsubscribe();
      }
    });
  }

  private async killTaskProcess(taskId: string, task: Task): Promise<void> {
    // Kill the spawned child process
    if (task.childProcess) {
      task.childProcess.kill('SIGTERM');
      // Wait for clean exit (with timeout)
      await new Promise(r => setTimeout(r, 2000));
      if (!task.childProcess.killed) {
        task.childProcess.kill('SIGKILL');
      }
    }

    // Capture execution logs
    const logs = await this.captureExecutionLogs(taskId);
    this.killedProcesses.set(taskId, { timestamp: new Date(), logs });

    // Publish killed event
    await this.redisClient.publish(`takeover:${taskId}:events`, JSON.stringify({
      type: 'KILLED',
      logs,
      timestamp: new Date().toISOString(),
    }));
  }

  private async resumeTask(taskId: string, task: Task): Promise<void> {
    // Resume means: re-execute the same task with the same context + operator messages
    task.status = 'RUNNING';
    // Control loop will pick it up again in next iteration

    await this.redisClient.publish(`takeover:${taskId}:events`, JSON.stringify({
      type: 'RESUMED',
      timestamp: new Date().toISOString(),
    }));
  }

  private async rerunTask(taskId: string, task: Task): Promise<void> {
    // Reset task to pending, re-enqueue
    task.status = 'PENDING';
    task.attempt = (task.attempt || 0) + 1;

    // Re-enqueue to front of queue
    await this.enqueueTask(task, { priority: 'high' });

    await this.redisClient.publish(`takeover:${taskId}:events`, JSON.stringify({
      type: 'REQUEUED',
      timestamp: new Date().toISOString(),
    }));
  }

  private async completeTask(taskId: string, task: Task, notes: string): Promise<void> {
    task.status = 'COMPLETED';
    task.manualCompletion = { notes, completedAt: new Date().toISOString() };

    await this.redisClient.publish(`takeover:${taskId}:events`, JSON.stringify({
      type: 'COMPLETED',
      timestamp: new Date().toISOString(),
    }));
  }

  private async abortTask(taskId: string, task: Task, notes: string): Promise<void> {
    task.status = 'BLOCKED';
    task.blockedReason = notes;

    await this.redisClient.publish(`takeover:${taskId}:events`, JSON.stringify({
      type: 'BLOCKED',
      timestamp: new Date().toISOString(),
    }));
  }

  private async captureExecutionLogs(taskId: string): Promise<string> {
    // Fetch last N lines of agent output
    // Implementation depends on where logs are stored (Redis, file, agent response)
    const logs = await this.redisClient.lrange(`task:${taskId}:logs`, -50, -1);
    return logs.join('\n');
  }
}
```

In the control loop, detect `TAKEOVER` status and activate listener:

```typescript
// In controlLoop main loop
if (activeTask.status === 'RUNNING') {
  // Start takeover listener in parallel (non-blocking)
  takeoverHandler.handleTakeoverCommands(activeTask.task_id, activeTask)
    .catch(err => logger.error('Takeover handler error:', err));

  // Execute task normally
  const result = await executor.execute(activeTask);
  activeTask.status = 'COMPLETED';
} else if (activeTask.status === 'TAKEOVER') {
  // Already in takeover, waiting for operator action
  // (takeover handler will manage transitions)
}
```

## Files to Create/Modify

| File | Change |
|------|--------|
| New: `UI/backend/src/services/takeoverService.ts` | Session management |
| New: `UI/backend/src/routes/takeover.ts` | REST + WebSocket routes |
| `UI/backend/src/app.ts` | Mount takeover routes, init socket.io |
| `UI/backend/package.json` | Add `socket.io` |
| New: `src/application/services/controlLoop/modules/takeoverHandler.ts` | Command handling, task kill/resume logic |
| `src/application/services/controlLoop/index.ts` | Integrate takeoverHandler |
