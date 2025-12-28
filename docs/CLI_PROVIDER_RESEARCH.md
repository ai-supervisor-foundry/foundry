# CLI Provider Research Documentation

## Priority Order
**Updated:** Cursor → Claude → Gemini → Codex

## Research Findings (Based on Actual CLI Research)

### 1. Cursor CLI ✅ (Implemented)
- **Command:** `cursor agent --print --force --output-format text --model <mode> <prompt>`
- **Status:** Fully implemented and working
- **Error Detection:** `ConnectError: [resource_exhausted] Error` in stderr
- **Documentation:** https://cursor.com/cli
- **Installation:** Built into Cursor IDE, CLI available via `cursor` command

### 2. Claude CLI ❌ (No Official CLI)
- **Status:** **No dedicated CLI tool exists**
- **Research Findings:**
  - Anthropic has NOT released a dedicated CLI for Claude
  - Claude is primarily accessible through:
    - APIs (Anthropic API)
    - Platform integrations (VS Code, GitHub, Notion, Canva, etc.)
    - Model Context Protocol (MCP) integrations
- **Implementation Options:**
  - **Option A:** Use Anthropic SDK (`@anthropic-ai/sdk`) via Node.js API calls
    - Requires HTTP API integration (not CLI spawn)
    - Requires API key management
    - More reliable than creating a wrapper
  - **Option B:** Create wrapper script that uses SDK
    - Could create a Node.js script that acts as CLI
    - Accepts prompt via stdin or argument
    - Outputs to stdout
- **Recommended Approach:** Use Anthropic SDK directly (HTTP API, not CLI spawn)
  - More reliable than trying to create a CLI wrapper
  - Better error handling
  - Native TypeScript support

### 3. Gemini CLI ❌ (No Official CLI)
- **Status:** **No publicly available CLI exists**
- **Research Findings:**
  - Google has NOT released a dedicated CLI for Gemini
  - Gemini is accessible through:
    - APIs (Google Generative AI API)
    - Web interfaces
    - SDK integrations
- **Implementation Options:**
  - **Option A:** Use Google Generative AI SDK (`@google/generative-ai`) via Node.js API calls
    - Requires HTTP API integration (not CLI spawn)
    - Requires API key management
    - More reliable than trying to create a wrapper
  - **Option B:** Use `gcloud` CLI with Gemini API (if supported)
    - May have limited functionality
    - Requires gcloud setup
- **Recommended Approach:** Use Google Generative AI SDK directly (HTTP API, not CLI spawn)
  - More reliable than trying to create a CLI wrapper
  - Better error handling
  - Native TypeScript support

### 4. Codex CLI ✅ (Official CLI Exists!)
- **Status:** **Official CLI tool available**
- **Research Findings:**
  - OpenAI provides an official CLI tool for Codex
  - **Installation:** `npm install -g @openai/codex`
  - **Usage:** `codex` (launches interactive terminal UI)
  - **Documentation:** https://developers.openai.com/codex/cli
  - **Features:**
    - Interactive terminal interface
    - Can read, modify, and run code locally
    - Supports different modes (Suggest, Auto-Edit, Full-Auto)
    - Authentication via ChatGPT account
- **Implementation Approach:**
  - Use CLI spawn similar to Cursor CLI
  - Command: `codex` (may need to check for non-interactive mode flags)
  - May need to research non-interactive/headless mode options
  - Check if it supports passing prompts via command line arguments

## Implementation Strategy

### Current Status
- ✅ Cursor CLI: Fully implemented with circuit breaker
- ⏳ Claude: Stub created, needs API integration
- ⏳ Gemini: Stub created, needs API integration  
- ⏳ Codex: Stub created, needs research and implementation

### Next Steps (Incremental Approach)
1. **Keep stubs as-is** - They will throw "not yet implemented" errors
2. **Implement as needed** - When Cursor hits resource exhaustion, implement next provider
3. **API vs CLI Decision:**
   - If no official CLI exists → Use SDK/API directly
   - If official CLI exists → Use CLI spawn (like Cursor)
   - Hybrid: Create thin wrapper scripts if needed

### API Integration Approach (If No CLI)
If providers don't have CLI tools, we can:
1. Create API adapter modules (separate from CLI adapter)
2. Use HTTP requests or SDKs directly
3. Convert API responses to `CursorResult` format
4. Maintain same interface for supervisor

## Notes

- **Incremental Implementation:** As per user request, implement providers as we face resource exhaustion
- **Circuit Breaker:** Already working for Cursor CLI
- **Priority Order:** Updated to Cursor → Claude → Gemini → Codex
- **Error Detection:** Will be refined as each provider is implemented

