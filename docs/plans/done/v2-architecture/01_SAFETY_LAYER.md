# V2 Module: The Safety Layer

**Status:** Planned
**Priority:** Critical (Phase 1)
**Inspiration:** `claude-flow/hooks/bash-hook.sh`

## 1. Overview
Currently, Foundry relies on the LLM's "common sense" and the Sandbox's isolation to prevent damage. This is insufficient. An LLM can accidentally delete files, commit secrets, or run infinite loops.

The **Safety Layer** is a deterministic middleware that sits between the `Agent` and the `ToolExecutor`. It intercepts every tool call, analyzes it against a policy, and modifies, blocks, or approves it *before* execution.

## 2. Architecture: The `ToolMiddleware` Pattern

We will introduce a `ToolMiddleware` interface in `src/domain/tooling/middleware.ts`.

```typescript
interface ToolMiddleware {
  name: string;
  priority: number;
  intercept(call: ToolCall): Promise<ToolCallResult | 'CONTINUE'>;
}
```

### The Pipeline
1.  **Agent** requests `run_shell_command("rm -rf ./src")`.
2.  **Middleware 1 (Sanitizer):** Normalizes path, checks for `..` traversal.
3.  **Middleware 2 (SafetyPolicy):** Detects `rm -rf`. Checks `allow_destructive` config.
4.  **Middleware 3 (SecretGuard):** Scans for regex matches of API keys.
5.  **Executor:** Runs the command (if all passed).

## 3. Key Components

### A. Command Sanitizer (The "Bash Hook")
Based on the `claude-flow` implementation, this component uses Regex to detect high-risk binaries.

**Risk Categories:**
*   **CRITICAL (Block):** `dd`, `mkfs`, `fdisk`, `shred`, `:(){ :|:& };:` (fork bombs).
*   **HIGH (Require Confirmation):** `rm -rf`, `git push --force`, `aws`, `gcloud` (cloud CLI state changes).
*   **MODERATE (Sanitize):** `rm` (inject `-i`), `chmod -R`.
*   **LOW (Allow):** `ls`, `grep`, `cat`, `echo`, `npm test`.

**Behavior:**
- **CRITICAL:** Immediate failure. Return "Command Blocked by Policy".
- **HIGH:** Pause execution. Send `SafetyChallenge` event to UI. Wait for Operator approval.
- **MODERATE:** Modify command (e.g., `rm file` -> `rm -i file`) and execute.

### B. Secret Redaction
**Problem:** Agents sometimes echo environment variables or print secrets to logs.
**Solution:**
- Load all sensitive ENV vars (regex `*_KEY`, `*_SECRET`, `*_TOKEN`) into a `RedactionSet`.
- Middleware scans both **Input** (Command) and **Output** (Stdout/Stderr).
- Replace occurrences with `[REDACTED]`.

### C. Path Confinement (Already exists, but reinforce)
- Ensure no command targets paths outside `SANDBOX_ROOT`.
- Block absolute paths (`/etc/passwd`).
- Block `..` traversal above root.

## 4. Implementation Plan

### Step 1: Create Middleware Engine
- [ ] Define `ToolMiddleware` interface.
- [ ] Refactor `ToolRegistry` to support middleware chains.

### Step 2: Port Bash Hooks
- [ ] Create `ShellSafetyMiddleware`.
- [ ] Implement Regex library for CRITICAL/HIGH/MODERATE commands.
- [ ] Implement `confirm_risky_action` state (pauses Control Loop).

### Step 3: Secret Guard
- [ ] Create `SecretGuardMiddleware`.
- [ ] Connect to `ConfigService` to identify secrets.

## 5. UI Integration
The Dashboard (`UI/`) currently handles Tasks. We need a **Safety Modal**.
- **Event:** `SAFETY_CHALLENGE`
- **Payload:** `{ command: "rm -rf src", risk: "HIGH", reason: "Destructive Action" }`
- **UI Action:** Pop up a modal: "Agent wants to run `rm -rf src`. Allow? [Yes/No]"
- **Response:** UI sends `RESUME_TASK` or `CANCEL_TASK`.
