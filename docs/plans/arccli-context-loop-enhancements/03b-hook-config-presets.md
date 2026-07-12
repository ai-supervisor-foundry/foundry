# 03b — Hook Config Schema & Security Presets

## Source Files
- `crates/arc-hooks/src/config.rs` — HooksConfig, HookDefinition, HookMatcher
- `crates/arc-hooks/src/security_presets.rs` — 5 default security hooks
- `crates/arc-hooks/src/rewrite.rs` — Input/output modification hooks
- `crates/arc-hooks/src/git_intel.rs` — Git context injection
- `.arc/hooks.toml` — User-facing config format

## Hook Definition Schema

```typescript
interface HookDefinition {
  name: string;
  description: string;
  matcher: {
    event: string;               // event type to match
    toolPattern?: string;        // regex against tool name (optional)
  };
  action: {
    type: 'command';
    command: string;             // shell script
    workingDirectory?: string;
    env?: Record<string, string>;
  };
  timeoutMs: number;             // default 5000
  enabled: boolean;
  priority: number;              // lower = runs first
  installedByPlugin?: string;    // for bulk plugin hook management
}
```

## Config Format (JSON equivalent of .arc/hooks.toml)

```json
{
  "hooks": {
    "block-force-push": {
      "description": "Block force push to protected branches",
      "priority": 1,
      "timeoutMs": 2000,
      "matcher": { "event": "PreToolUse", "toolPattern": "^bash$" },
      "action": { "type": "command", "command": "check-force-push.sh" }
    }
  }
}
```

## 5 Default Security Presets

### 1. block-sensitive-writes
Blocks writes to `.env`, `.git/`, production configs, private keys
(`*.pem`, `*.key`, `id_rsa`, `id_ed25519`)

### 2. command-injection-scanner
Detects backtick injection, `| sh`, `curl|bash`, dangerous `rm -rf /`

### 3. dangerous-code-scanner
Scans for `eval()`, `os.system()`, `pickle.loads`, `innerHTML`,
SQL injection strings, hardcoded secrets in generated code

### 4. block-force-push
Blocks `git push --force` to `main`, `master`, `production`, `release`

### 5. auto-format (opt-in)
Runs formatter on edited files (prettier, black, rustfmt, gofmt)

## Rewrite Hooks

`rewrite.rs` — modifies tool inputs/outputs based on hook rules.
Acts as an input sanitization layer before tool execution.

## Git Intelligence

`git_intel.rs` — provides git context (branch, staged files, diff stats)
to hook scripts via environment variables or stdin payload enrichment.

## Acceptance Criteria

- [ ] HookDefinition schema with matcher, action, priority, timeout
- [ ] 5 security presets active by default on init
- [ ] Config loaded from project `.supervisor/hooks.json` + global
- [ ] Plugin attribution enables bulk hook management
- [ ] Rewrite hooks can modify tool input before execution
