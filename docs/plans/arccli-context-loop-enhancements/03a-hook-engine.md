# 03a — Hook Engine: Events, Dispatch, Execution

## Source Files
- `crates/arc-hooks/src/engine.rs` — HookEngine, fire(), blocking/parallel
- `crates/arc-hooks/src/events.rs` — HookEvent enum
- `crates/arc-hooks/src/executor.rs` — Shell execution, exit codes
- `tests/integration/hook_lifecycle.rs` — Full lifecycle tests

## Hook Events

```typescript
type HookEvent =
  | { type: 'SessionStart' }
  | { type: 'PreToolUse'; toolName: string; input: unknown }
  | { type: 'PostToolUse'; toolName: string; output: string }
  | { type: 'Stop'; reason: string }
  | { type: 'UserPromptSubmit'; prompt: string }
  | { type: 'PermissionRequest'; tool: string; action: string }
  | { type: 'Notification'; message: string };
```

**Blocking events** (sequential, first Block stops chain):
`PreToolUse`, `Stop`, `UserPromptSubmit`, `PermissionRequest`

**Non-blocking events** (parallel, Block outcomes logged only):
`SessionStart`, `PostToolUse`, `Notification`

## Execution Protocol

1. Shell command receives **event JSON on stdin**
2. Exit codes: `0` = Allow, `2` = Block, anything else = Error
3. Stdout captured as hook output/reason
4. Timeout kills subprocess after `timeoutMs`

## HookEngine Dispatch

```typescript
async function fire(event: HookEvent, hooks: HookDefinition[]): HookDecision {
  const matching = hooks
    .filter(h => h.enabled && matchesEvent(h.matcher, event))
    .sort((a, b) => a.priority - b.priority);

  if (isBlockingEvent(event.type)) {
    for (const hook of matching) {
      const result = await executeHook(hook, event);
      if (result.action === 'block')
        return { action: 'block', reason: result.reason, hookName: hook.name };
    }
    return { action: 'proceed' };
  } else {
    await Promise.all(matching.map(h => executeHook(h, event)));
    return { action: 'proceed' };
  }
}
```

## HookStats Telemetry

```typescript
interface HookStats {
  invocationCount: number;
  totalDurationMs: number;
  blockCount: number;
  errorCount: number;
}
```

## Dynamic Hook Registration

- `registerHook(name, definition)` — add at runtime (plugins)
- `unregisterHook(name)` — remove at runtime
- `disablePluginHooks(pluginName)` — bulk disable by plugin attribution

## Acceptance Criteria

- [ ] HookEngine fires events with blocking/parallel semantics
- [ ] Shell hooks receive JSON on stdin, exit 2 = block
- [ ] Priority ordering (lower = first) for sequential hooks
- [ ] Per-hook timeout with subprocess kill
- [ ] Dynamic registration/unregistration API
- [ ] HookStats tracked per hook
