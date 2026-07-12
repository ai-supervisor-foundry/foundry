# 03 — Takeover Frontend UI

## Components

### 1. TakeoverPanel (slide-over)

Entry point: "Take Over" button on task cards (Dashboard, Tasks page).

Location: Right slide-over panel (80% width on desktop, full-screen on mobile).

Route param: `/dashboard?takeover=fix-login-bug`

```typescript
// UI/frontend/src/components/TakeoverPanel.tsx

interface TakeoverPanelProps {
  taskId: string;
  onClose: () => void;
}

// State:
// - session: TakeoverSession
// - messages: TakeoverMessage[]
// - status: 'connecting' | 'killing' | 'active' | 'ending'
// - executionLogs: string
// - inputValue: string
```

### 2. TakeoverChat

Reuses styling from existing `ChatVisualizer`:
- **System messages** — gray background, monospace
- **Operator messages** — indigo background, right-aligned
- **Logs section** — collapsible panel with execution logs
- Auto-scroll to bottom
- Markdown rendering for code blocks

```typescript
// UI/frontend/src/components/TakeoverChat.tsx

interface TakeoverChatProps {
  messages: TakeoverMessage[];
  executionLogs: string;
  status: string;
}
```

### 3. TakeoverActions

Bottom action bar with four buttons:

```typescript
// UI/frontend/src/components/TakeoverActions.tsx

interface TakeoverActionsProps {
  taskId: string;
  onResume: () => void;
  onRerun: () => void;
  onComplete: (notes: string) => void;
  onAbort: (notes: string) => void;
}

// Buttons:
// [Resume ▶] — green, resumes with updated context
// [Rerun ↻] — yellow, resets task to pending, re-enqueues
// [Complete ✓] — indigo, marks complete with operator notes
// [Abort ✕] — red, marks blocked with operator notes

// Complete/Abort show a modal for operator notes before executing
```

## WebSocket Integration

```typescript
// UI/frontend/src/hooks/useTakeover.ts

export function useTakeover(taskId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [session, setSession] = useState<TakeoverSession | null>(null);
  const [messages, setMessages] = useState<TakeoverMessage[]>([]);
  const [status, setStatus] = useState<string>('connecting');
  const [executionLogs, setExecutionLogs] = useState<string>('');

  useEffect(() => {
    // Start takeover session
    const startTakeover = async () => {
      const res = await fetch(`/api/takeover/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      setSession(data.session);
      setExecutionLogs(data.executionLogs);
      setStatus('active');
    };

    startTakeover();

    // Connect WebSocket
    const s = io(API_URL, { transports: ['websocket'] });
    s.emit('takeover:join', { taskId });
    s.on('takeover:started', () => setStatus('active'));
    s.on('takeover:error', (err) => setStatus('error'));
    setSocket(s);

    return () => { s.disconnect(); };
  }, [taskId]);

  const sendMessage = (content: string) => {
    socket?.emit('takeover:message', { taskId, content });
    setMessages(prev => [...prev, {
      role: 'operator',
      content,
      timestamp: new Date().toISOString(),
    }]);
  };

  const endTakeover = async (action: 'resume' | 'rerun' | 'complete' | 'abort', notes?: string) => {
    const res = await fetch(`/api/takeover/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action, operatorMessage: notes }),
    });
    setStatus('ended');
  };

  return { session, messages, status, executionLogs, sendMessage, endTakeover };
}
```

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  ← Back                   Take Over: fix-login-bug    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  TASK CONTEXT                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Intent: Fix login form email validation         │ │
│  │ Project: easeclassifieds                         │ │
│  │ Acceptance:                                      │ │
│  │  • Validate email format                        │ │
│  │  • Show error on invalid input                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [Show Execution Logs ▼]                             │
│                                                      │
│  ┌─ EXECUTION LOGS ──────────────────────────────┐  │
│  │ > Analyzing src/components/LoginForm.tsx      │  │
│  │ Found email validation: /^.+@.+\..+$/          │  │
│  │ Issue: Doesn't handle '+' in local part       │  │
│  │ Creating fix...                                │  │
│  │ Killed: SIGTERM received                      │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ OPERATOR ────────────────────────────────────┐  │
│  │ The regex needs to allow '+'. Update to:       │  │
│  │ /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\...       │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Type instructions...                             │ │
│  │                                    [Send]         │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [Resume ▶] [Rerun ↻] [Complete ✓] [Abort ✕]        │
└──────────────────────────────────────────────────────┘
```

## Task Card Integration

Add "Take Over" button to task cards showing `in_progress` status:

```typescript
// UI/frontend/src/components/TaskCard.tsx

// In task card footer:
{task.status === 'in_progress' && (
  <>
    <Button onClick={() => handleViewLogs(task.id)}>View Logs</Button>
    <Button variant="secondary" onClick={() => handleTakeover(task.id)}>
      Take Over
    </Button>
  </>
)}
```

## Keyboard Shortcuts

- `Enter` — Send message (when input focused)
- `Shift+Enter` — Newline in message
- `Escape` — Close panel (with confirmation if messages exist)
- `Ctrl+R` — Quick-resume

## Files to Create/Modify

| File | Change |
|------|--------|
| New: `UI/frontend/src/components/TakeoverPanel.tsx` | Main slide-over component |
| New: `UI/frontend/src/components/TakeoverChat.tsx` | Chat message rendering |
| New: `UI/frontend/src/components/TakeoverActions.tsx` | Action buttons |
| New: `UI/frontend/src/hooks/useTakeover.ts` | WebSocket hook |
| `UI/frontend/src/pages/Dashboard.tsx` | Add takeover query param handling |
| `UI/frontend/src/components/TaskCard.tsx` | Add "Take Over" button |
| `UI/frontend/src/services/api.ts` | Add takeover API methods |
| `UI/frontend/package.json` | Add `socket.io-client` |

## Styling

All new components follow existing indigo theme:
- Cards: `rounded-xl border border-gray-200`
- Buttons: `rounded-lg transition-colors`
- Operator message: `bg-indigo-50 rounded-2xl`
- System/exec logs: `bg-gray-50 font-mono text-sm`
