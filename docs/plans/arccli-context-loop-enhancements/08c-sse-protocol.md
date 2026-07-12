# 08c — SSE Streaming & Message Protocol

## Source Files
- `crates/arc-a2a/src/streaming.rs` — SSE task progress stream
- `crates/arc-a2a/src/protocol.rs` — A2AMessage, MessageType

## SSE Update Types

```typescript
type SseUpdate =
  | { event: 'state_changed'; data: { state: TaskState } }
  | { event: 'progress'; data: { progress: number; message: string } }
  | { event: 'completed'; data: { output: unknown } }
  | { event: 'failed'; data: { error: string } }
  | { event: 'heartbeat'; data: {} };
```

- 15s keepalive heartbeat interval
- Stream stops on terminal state (completed/failed/canceled)

## A2A Message Protocol

```typescript
interface A2AMessage {
  messageId: string;
  senderId: string;
  targetId: string;
  type: MessageType;
  payload: MessagePayload;
  timestamp: string;
  correlationId?: string;
  signature?: string;
}

type MessageType =
  | 'task_request' | 'task_result' | 'task_progress'
  | 'context_share' | 'inquiry' | 'inquiry_response'
  | 'task_canceled' | 'error_report' | 'ping' | 'pong';
```

## Key Payload Types

```typescript
interface TaskPayload {
  taskId: string;
  skillId: string;
  input: unknown;
  timeoutSecs?: number;
  priority?: number;
  callbackUrl?: string;
}

interface ResultPayload {
  taskId: string;
  output: unknown;
  executionTimeMs: number;
  tokensUsed?: number;
}

interface ProgressPayload {
  taskId: string;
  progress: number;          // 0.0 - 1.0
  statusMessage: string;
  partialOutput?: unknown;
}
```

## Acceptance Criteria

- [ ] SSE streaming for real-time task progress
- [ ] 15s heartbeat keepalive
- [ ] Correlation IDs for request/response pairing
- [ ] Typed message payloads for task lifecycle
