# 06b — Conseca: LLM-Generated Dynamic Security Policy

## Source Files
- `crates/arc-policy/src/conseca.rs` — Dynamic policy generation + enforcement

## Core Concept

Before each user turn, ask the LLM to generate a `SecurityPolicy` JSON based on
the user's intent. Then enforce that policy on all subsequent tool calls in that
turn. The LLM constrains what it can do — **meta-safety**.

## SecurityPolicy Schema

```typescript
interface SecurityPolicy {
  allowedTools: ToolPermission[];
  deniedPatterns: string[];
  maxFileWriteCount: number;
  restrictedPaths: string[];
}

interface ToolPermission {
  toolName: string;
  allowed: boolean;
  allowedArgs?: ArgConstraint[];
}

interface ArgConstraint {
  argName: string;
  mustMatch?: string;          // regex pattern
  mustNotContain?: string[];   // blocked substrings
}

type SafetyDecision = 'allow' | 'deny' | 'ask_user';
```

## Policy Generation Prompt

```
Given the user's request, generate a SecurityPolicy JSON that constrains
which tools the agent may use and what arguments are acceptable.

User request: "{userPrompt}"

Rules:
- Only allow tools necessary for this specific request
- Deny patterns that could lead to data exfiltration
- Set maxFileWriteCount to the minimum needed
- Restrict paths to only relevant directories

Output valid JSON matching the SecurityPolicy schema.
```

## Enforcement Flow

```
1. User submits prompt
2. LLM generates SecurityPolicy JSON from user intent
3. Store policy for this turn
4. On each tool call:
   a. Check tool name against allowedTools
   b. Check args against ArgConstraints (mustMatch regex, mustNotContain)
   c. Check file path against restrictedPaths
   d. Increment write counter → check maxFileWriteCount
5. Return SafetyDecision: allow / deny / ask_user
```

## Dual-Layer Architecture

```
User Prompt
    ↓
[Static PolicyEngine] — always-on rules (06a)
    ↓
[Conseca Dynamic Policy] — per-turn LLM-generated constraints
    ↓
[Tool Execution] — only if both layers allow
```

## Why Conseca Matters

- **Prompt injection defense** — even if attacker injects instructions,
  pre-generated policy limits executable tools
- **Least privilege per turn** — each turn gets only needed permissions
- **Adaptive** — complex requests get more permissions, simple fewer
- **Transparent** — policy is inspectable JSON, logged for audit

## Acceptance Criteria

- [ ] Conseca generates SecurityPolicy JSON from user prompt
- [ ] Per-turn policy enforced on every tool call
- [ ] ArgConstraint validation (mustMatch regex, mustNotContain)
- [ ] maxFileWriteCount tracks and limits writes per turn
- [ ] Both static + dynamic layers must allow before execution
- [ ] Policy JSON logged for audit trail
