// @todo - Move to a common git submodule or package so we may not have dangling outdated deps stored in multiple places.
export const PROVIDER_MODELS: Record<string, string[]> = {
    claude: ['auto', 'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
    cursor: ['auto', 'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5', 'composer-1', 'composer-1.5', 'composer-2', 'gpt-5.2', 'gpt-5.3', 'gpt-5.4', 'gemini-3-pro-preview'],
    gemini: ['auto', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-preview'],
    copilot: ['auto', 'claude-sonnet-4.6', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5', 'claude-sonnet-4', 'gemini-3-pro-preview', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1-codex', 'gpt-5.1', 'gpt-5', 'gpt-5.1-codex-mini', 'gpt-5-mini'],
    codex: ['auto', 'codex-mini', 'o4-mini', 'o3'],
    ollama: ['phi4-mini'],
    gemini_stub: ['auto'],
};