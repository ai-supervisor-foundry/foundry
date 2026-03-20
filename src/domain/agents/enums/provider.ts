export enum Provider {
    CURSOR = 'cursor',
    COPILOT = 'copilot',
    CLAUDE = 'claude',
    CODEX = 'codex',
    GEMINI = 'gemini',
    GEMINI_STUB = 'gemini-stub',
    OLLAMA = 'ollama',
}

const PROVIDER_VALUES = new Set<string>(Object.values(Provider));

export function isValidProvider(value: string | undefined | null): value is Provider {
    if (!value) return false;
    return PROVIDER_VALUES.has(value);
}