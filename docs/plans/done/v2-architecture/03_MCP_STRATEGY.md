# V2 Module: MCP Integration Strategy

**Status:** Planned
**Priority:** Medium (Phase 3)
**Inspiration:** `claude-flow`'s native MCP support.

## 1. Overview
Currently, Foundry maintains custom implementations for every tool: `read_file`, `run_shell_command`, etc. This is unscalable.

The **Model Context Protocol (MCP)** is an open standard for exposing tools and context to LLMs. By becoming an **MCP Client**, Foundry gains access to a massive ecosystem of pre-built tools (Postgres, GitHub, Slack, Google Drive) without writing a single line of tool-specific code.

## 2. Architecture: The MCP Client Adapter

We will introduce an `MCPClientService` that bridges Foundry's internal `ToolRegistry` with external MCP Servers.

### Components
1.  **MCP Connection Manager:** Manages SSE/Stdio connections to MCP Servers.
2.  **Tool Converter:** Converts MCP Tool Schemas (JSON Schema) -> Foundry Tool Definitions (Gemini/OpenAI format).
3.  **Transport Layer:** Handles the request/response cycle.

### Configuration
```json
// .gemini/mcp-config.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "..." }
    }
  }
}
```

## 3. Implementation Steps

### Step 1: Core Client
- [ ] Install `@modelcontextprotocol/sdk`.
- [ ] Create `MCPClientService`.
- [ ] Implement `connect(serverConfig)` method.

### Step 2: Tool Discovery
- [ ] Implement `listTools()` on the client.
- [ ] Map MCP tools to `ToolDefinition` objects used by our `PromptBuilder`.

### Step 3: Execution Proxy
- [ ] When Agent calls `github_create_issue(...)`:
    1.  Interceptor catches call.
    2.  `MCPClientService` routes it to the "github" server.
    3.  Result is returned to Agent.

## 4. Strategic Benefit
**Differentiation:** `claude-flow` is deeply tied to the *Anthropic* implementation of MCP. Foundry will be a **Provider-Agnostic MCP Client**.
- Use MCP tools with **Gemini**.
- Use MCP tools with **OpenAI**.
- Use MCP tools with **Local Llama**.

This "Democratization of MCP" is a huge selling point. We decouple the *Standard* from the *Model Vendor*.
