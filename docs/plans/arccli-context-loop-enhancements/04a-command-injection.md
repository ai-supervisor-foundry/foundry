# 04a — Command Injection & Shell Safety

## Source Files
- `tests/security/command_injection.rs` — Shell command validation
- `crates/arc-tools/src/security/sandbox.rs` — ToolSandbox
- `tests/integration/security_hooks.rs` — Security hook patterns

## Blocked Command Patterns

```typescript
const BLOCKED_COMMAND_PATTERNS = [
  /`/,                                         // backtick substitution
  /\$\(/,                                      // command substitution
  /\|\s*(ba)?sh(\s|$)/i,                       // pipe to shell
  /(curl|wget).*\|/i,                          // download-and-pipe
  /rm\s+(-rf?|--recursive)\s+(\/|~|\$HOME)/,   // destructive rm
  /eval\s/i,                                   // eval injection
  /;\s*(rm|dd|mkfs|shutdown|reboot)/,           // chained destructive
];
```

## Safe Commands (Auto-Approve Mode)

```typescript
const SAFE_COMMANDS = [
  'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
  'git status', 'git log', 'git diff', 'git branch',
  'cargo check', 'cargo build', 'cargo test',
  'npm test', 'npm run lint', 'npx tsc --noEmit',
];
```

## ToolSandbox Approval Modes

```typescript
type ApprovalMode = 'ask' | 'auto' | 'yolo' | 'readonly';

interface SandboxConfig {
  approvalMode: ApprovalMode;
  allowedPaths: string[];
  blockedCommands: string[];
  blockedPatterns: RegExp[];
  maxWriteSize: number;       // bytes
  maxToolCalls: number;       // per session
}

type SandboxVerdict =
  | 'allowed'
  | { needsApproval: string }
  | { blocked: string };
```

## Force-Push Guard

```typescript
const PROTECTED_BRANCHES = /^(main|master|production|release)/;

function isForceToProtected(command: string): boolean {
  return /git\s+push\s+.*--force/.test(command)
    && PROTECTED_BRANCHES.test(command);
}
```

## Acceptance Criteria

- [ ] Shell commands validated against blocked patterns before execution
- [ ] Safe commands auto-approved without user prompt
- [ ] Force-push to protected branches blocked
- [ ] SandboxConfig supports 4 approval modes
- [ ] maxToolCalls per session enforced
