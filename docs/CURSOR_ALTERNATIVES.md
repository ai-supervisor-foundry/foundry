# Cursor CLI Alternatives - Resource Exhaustion Solutions

## Problem
The supervisor is repeatedly hitting `ConnectError: [resource_exhausted]` from Cursor CLI, indicating Cursor's API usage limits have been reached.

## Current Architecture
- Supervisor uses `cursor agent --print --force --output-format text --model <mode> <prompt>`
- Expects: `stdout`, `stderr`, `exitCode`, `status` in `CursorResult` interface
- All interactions go through `src/cursorCLI.ts` → `dispatchToCursor()` function

## Solution Options

### Option 1: Direct API Integration (RECOMMENDED) ⭐

**Create an API adapter that implements the same `CursorResult` interface**

#### Supported Providers:
1. **OpenAI API** (GPT-4, GPT-4 Turbo, GPT-3.5)
   - Pros: Reliable, good rate limits, widely available
   - Cons: Costs money, but predictable pricing
   - Setup: Get API key from https://platform.openai.com/

2. **Anthropic Claude API** (Claude 3 Opus, Sonnet, Haiku)
   - Pros: Excellent coding capabilities, good rate limits
   - Cons: Costs money
   - Setup: Get API key from https://console.anthropic.com/

3. **Google Gemini API** (Gemini Pro, Gemini Ultra)
   - Pros: Free tier available, good performance
   - Cons: Rate limits on free tier
   - Setup: Get API key from https://ai.google.dev/

4. **OpenRouter** (Aggregates multiple models)
   - Pros: Single API for multiple models, fallback options
   - Cons: Additional layer
   - Setup: https://openrouter.ai/

#### Implementation Plan:
1. Create `src/apiAdapter.ts` that implements same interface as `cursorCLI.ts`
2. Add configuration for API provider selection (env vars or config file)
3. Map `agent_mode` to model names (e.g., "opus" → "claude-3-opus-20240229")
4. Implement retry logic with exponential backoff for rate limits
5. Add fallback chain: Primary API → Secondary API → Error

#### Code Structure:
```typescript
// src/apiAdapter.ts
export interface APIProvider {
  name: string;
  execute(prompt: string, model: string): Promise<APIResponse>;
}

export class OpenAIAdapter implements APIProvider { ... }
export class ClaudeAdapter implements APIProvider { ... }
export class GeminiAdapter implements APIProvider { ... }

export async function dispatchToAPI(
  prompt: string,
  cwd: string,
  agentMode?: string,
  provider?: string
): Promise<CursorResult> {
  // Convert to CursorResult format
}
```

#### Configuration:
```bash
# .env
AI_PROVIDER=openai  # or claude, gemini, openrouter
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...

# Fallback chain
AI_FALLBACK_PROVIDERS=claude,gemini
```

### Option 2: Aider CLI (Research Required)

**Aider is a CLI-based AI coding assistant**

- Need to verify: Does it support non-interactive mode?
- Does it accept prompts via command line?
- Can it output to stdout/stderr in expected format?

**Research Command:**
```bash
aider --help
aider --version
# Check if it supports --non-interactive or similar
```

### Option 3: Continue CLI (Research Required)

**Continue.dev may have CLI capabilities**

- Need to verify CLI interface
- Check documentation: https://continue.dev/

### Option 4: Hybrid Approach

**Use API adapter as primary, Cursor CLI as fallback**

- Try API first (better rate limits)
- Fall back to Cursor CLI if API fails
- Best of both worlds

## Recommended Implementation: Option 1 (Direct API)

### Phase 1: Create API Adapter
1. Install dependencies: `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`
2. Create `src/apiAdapter.ts` with provider implementations
3. Add environment variable configuration
4. Implement model mapping (agent_mode → API model names)

### Phase 2: Integrate with Supervisor
1. Add `AI_PROVIDER` env var to select provider
2. Modify `src/controlLoop.ts` to use API adapter when configured
3. Keep Cursor CLI as fallback option
4. Add provider selection logic

### Phase 3: Add Fallback Chain
1. Implement automatic fallback to next provider on failure
2. Add retry logic with exponential backoff
3. Log provider usage for monitoring

### Phase 4: Testing
1. Test with each provider individually
2. Test fallback chain
3. Test rate limit handling
4. Verify same output format as Cursor CLI

## Immediate Actions

1. **Short-term**: Implement OpenAI API adapter (most reliable)
2. **Medium-term**: Add Claude and Gemini adapters
3. **Long-term**: Implement fallback chain and monitoring

## Cost Considerations

- **OpenAI GPT-4**: ~$0.03 per 1K input tokens, $0.06 per 1K output tokens
- **Claude Opus**: ~$0.015 per 1K input tokens, $0.075 per 1K output tokens  
- **Gemini Pro**: Free tier available, then pay-as-you-go
- **OpenRouter**: Aggregates pricing from multiple providers

## Next Steps

1. Choose primary API provider (recommend OpenAI or Claude)
2. Get API key
3. Implement adapter following `CursorResult` interface
4. Test with one task
5. Deploy and monitor

