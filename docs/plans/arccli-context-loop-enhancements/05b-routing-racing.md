# 05b — Task-Based Routing & Parallel Racing

## Source Files
- `crates/arc-router/src/` — TaskClassifier, Router, UsageTracker
- `crates/arc-providers/src/router.rs` — ProviderRouter
- `crates/arc-providers/src/provider.rs` — Provider trait
- `crates/arc-providers/src/anthropic.rs` — Prompt caching
- `benches/provider_routing.rs` — Model cost/latency data

## Provider Interface

```typescript
interface Provider {
  name: string;
  capabilities: ProviderCapabilities;
  chat(messages: Message[], model: string): Promise<ChatResponse>;
  healthCheck(): Promise<boolean>;
}

interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  maxContextWindow: number;
}
```

## Task-Based Classification

```typescript
type TaskType = 'coding' | 'reasoning' | 'quick_fix' | 'explanation' | 'general';

function classifyTask(prompt: string): TaskType {
  if (/refactor|implement|code|write|create|build/i.test(prompt)) return 'coding';
  if (/fix|bug|error|issue|broken/i.test(prompt)) return 'quick_fix';
  if (/think|plan|architect|design|analyze/i.test(prompt)) return 'reasoning';
  if (/why|explain|how|what does/i.test(prompt)) return 'explanation';
  return 'general';
}

const TASK_ROUTING: Record<TaskType, string[]> = {
  coding:      ['claude-sonnet', 'gpt-4o'],
  reasoning:   ['claude-opus', 'claude-sonnet'],
  quick_fix:   ['claude-haiku', 'gpt-4o-mini'],
  explanation: ['claude-sonnet', 'gpt-4o'],
  general:     ['claude-sonnet', 'gpt-4o'],
};
```

## Model Cost Table

```typescript
const MODEL_COSTS = {
  'claude-sonnet':  { input: 0.003,   output: 0.015 },
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gpt-4o':         { input: 0.005,   output: 0.015 },
  'claude-haiku':   { input: 0.00025, output: 0.00125 },
  'ollama-local':   { input: 0,       output: 0 },
};
```

## Parallel Racing

```typescript
async function raceProviders(
  providers: Provider[],
  messages: Message[],
  model: string,
): Promise<ChatResponse> {
  const controller = new AbortController();
  return Promise.race(
    providers.map(p =>
      p.chat(messages, model).then(r => {
        controller.abort();
        return r;
      })
    )
  );
}
```

## Anthropic Prompt Caching

Apply `cache_control: { type: "ephemeral" }` to system message.
Reduces input token billing 85-90% on repeat sessions.

## Acceptance Criteria

- [ ] Task classification routes prompts to optimal models
- [ ] Fallback chain tries providers in configured order
- [ ] Parallel racing with cancellation of losers
- [ ] Prompt caching header enabled for Anthropic calls
- [ ] Model cost table used for cost-optimized routing
