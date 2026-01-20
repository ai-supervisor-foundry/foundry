# Scavenged Items from Claude Flow

## 1. Safety Wrapper (Bash Hook)
**Source:** `hooks/bash-hook.sh`
**Concept:** A lightweight middleware that sanitizes shell commands *before* execution.
**Why:** Foundry executes shell commands. We should wrap `run_shell_command` with similar heuristics.
**Code to steal:**
```bash
# Safety Checks
if echo "$COMMAND" | grep -qE "^(rm|rmdir|mv|dd|mkfs|fdisk|shred|chmod\s.*-R|chown\s.*-R)" && ! echo "$COMMAND" | grep -q "\-\-dry-run"; then
  # For rm commands, add interactive flag
  if echo "$COMMAND" | grep -qE "^rm\s" && ! echo "$COMMAND" | grep -qE "\-(i|I)"; then
    MODIFIED_COMMAND=$(echo "$COMMAND" | sed 's/^rm /rm -i /')
  fi
fi

# Secret Detection
if echo "$COMMAND" | grep -qE "(password|secret|token|key|api[-_]?key|auth)" && ! echo "$COMMAND" | grep -q "# SECRETS_OK"; then
   # Block or Warn
fi
```

## 2. Dual-Layer Memory Architecture
**Source:** `src/cli/commands/memory.ts` (`UnifiedMemoryManager`)
**Concept:** Try a high-performance DB (SQLite/Vector), but *gracefully* fall back to a simple JSON file if dependencies are missing.
**Why:** Reduces barrier to entry. Users don't need a running Docker container for `agentdb` just to try the tool.
**Pattern:**
```typescript
async getBackend(): Promise<MemoryBackend> {
  if (this.backend === 'sqlite' && !this.sqliteManager) {
    try {
      await initializeReasoningBank();
      return 'sqlite';
    } catch {
      console.log('Falling back to JSON');
      this.backend = 'json';
    }
  }
  return this.backend;
}
```

## 3. Comprehensive Agent State Model
**Source:** `src/swarm/coordinator.ts` (`AgentState` interface)
**Concept:** Tracking agent health, workload, and capabilities in detail.
**Why:** Foundry's `Agent` model is currently simple. We can add `workload`, `health`, and `capabilities` for better task distribution in the future.
**Fields of Interest:**
- `status`: 'idle' | 'busy' | 'paused' | 'offline' | 'terminating'
- `workload`: number (0-1)
- `capabilities`: { codeGeneration, testing, research, ... }
- `metrics`: { successRate, tasksCompleted, tasksFailed }

## 4. MCP Server Factory with Feature Flags
**Source:** `src/mcp/server-factory.ts`
**Concept:** A factory that builds the MCP server with toggles for "Experimental" features (MCP 2025).
**Why:** As we adopt MCP, we should allow users to opt-in to unstable features without breaking core functionality.

## 5. Task Decomposition Strategy
**Source:** `src/swarm/strategies/auto.ts` (Inferred from Coordinator)
**Concept:** The "Auto Strategy" breaks objectives into specific types: `research` -> `coding` -> `testing` -> `documentation`.
**Why:** Foundry's `CODING_STRATEGY` is monolithic. We should split it into specialized phases.
