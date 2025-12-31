# Parameters

## Global options

Global options can be used with any command:

OptionDescription`-v, --version`Output the version number`-a, --api-key <key>`API key for authentication (can also use `CURSOR_API_KEY` env var)`-p, --print`Print responses to console (for scripts or non-interactive use). Has access to all tools, including write and bash.`--output-format <format>`Output format (only works with `--print`): `text`, `json`, or `stream-json` (default: `text`)`--stream-partial-output`Stream partial output as individual text deltas (only works with `--print` and `stream-json` format)`-b, --background`Start in background mode (open composer picker on launch)`--fullscreen`Enable fullscreen mode`--resume [chatId]`Resume a chat session`-m, --model <model>`Model to use`-f, --force`Force allow commands unless explicitly denied`-h, --help`Display help for command
## Commands

CommandDescriptionUsage`login`Authenticate with Cursor`cursor-agent login``logout`Sign out and clear stored authentication`cursor-agent logout``status`Check authentication status`cursor-agent status``mcp`Manage MCP servers`cursor-agent mcp``update|upgrade`Update Cursor Agent to the latest version`cursor-agent update` or `cursor-agent upgrade``ls`Resume a chat session`cursor-agent ls``resume`Resume the latest chat session`cursor-agent resume``help [command]`Display help for command`cursor-agent help [command]`
When no command is specified, Cursor Agent starts in interactive chat mode by
default.

## MCP

Manage MCP servers configured for Cursor Agent.

SubcommandDescriptionUsage`login <identifier>`Authenticate with an MCP server configured in `.cursor/mcp.json``cursor-agent mcp login <identifier>``list`List configured MCP servers and their status`cursor-agent mcp list``list-tools <identifier>`List available tools and their argument names for a specific MCP`cursor-agent mcp list-tools <identifier>`
All MCP commands support `-h, --help` for command-specific help.

## Arguments

When starting in chat mode (default behavior), you can provide an initial prompt:

**Arguments:**

- `prompt` — Initial prompt for the agent

## Getting help

All commands support the global `-h, --help` option to display command-specific help.