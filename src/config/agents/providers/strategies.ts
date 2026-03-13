import { Provider } from "../../../domain/agents/enums/provider";

export interface ProviderEntry {
    provider: Provider;
    agentMode: string;
}

export interface ProviderStrategy {
    name: string;
    primary: ProviderEntry[];    // main task executor — no Ollama
    secondary: ProviderEntry[];  // helper agent + interrogator — Ollama allowed
}

// Strategy 1 (default): Claude primary, Cursor/Gemini/Ollama secondary
export const STRATEGY_1: ProviderStrategy = {
    name: 'claude-primary',
    primary: [
        { provider: Provider.CLAUDE, agentMode: 'auto' },
        { provider: Provider.CURSOR, agentMode: 'auto' },
        { provider: Provider.GEMINI, agentMode: 'auto' },
    ],
    secondary: [
        { provider: Provider.CURSOR, agentMode: 'auto' },
        { provider: Provider.GEMINI, agentMode: 'auto' },
        { provider: Provider.OLLAMA, agentMode: 'phi4-mini' },
    ],
};

// Strategy 2: Cursor primary, Gemini/Ollama/Claude secondary
export const STRATEGY_2: ProviderStrategy = {
    name: 'cursor-primary',
    primary: [
        { provider: Provider.CURSOR, agentMode: 'auto' },
        { provider: Provider.GEMINI, agentMode: 'auto' },
        { provider: Provider.CLAUDE, agentMode: 'auto' },
    ],
    secondary: [
        { provider: Provider.GEMINI, agentMode: 'auto' },
        { provider: Provider.OLLAMA, agentMode: 'phi4-mini' },
        { provider: Provider.CLAUDE, agentMode: 'auto' },
    ],
};

// Strategy 3: Gemini primary, Claude/Cursor/Ollama secondary
export const STRATEGY_3: ProviderStrategy = {
    name: 'gemini-primary',
    primary: [
        { provider: Provider.GEMINI, agentMode: 'auto' },
        { provider: Provider.CLAUDE, agentMode: 'auto' },
        { provider: Provider.CURSOR, agentMode: 'auto' },
    ],
    secondary: [
        { provider: Provider.CURSOR, agentMode: 'auto' },
        { provider: Provider.GEMINI, agentMode: 'gemini-2.5-flash-lite' },
        { provider: Provider.CLAUDE, agentMode: 'auto' },
        { provider: Provider.OLLAMA, agentMode: 'phi4-mini' },
    ],
};

const STRATEGIES: Record<string, ProviderStrategy> = {
    '1': STRATEGY_1,
    '2': STRATEGY_2,
    '3': STRATEGY_3,
};

/**
 * Returns the active strategy based on PROVIDER_STRATEGY env var (default: '1').
 * Config-defined; env can override.
 */
export function getActiveStrategy(): ProviderStrategy {
    const strategyId = process.env.PROVIDER_STRATEGY || '1';
    const strategy = STRATEGIES[strategyId];
    if (!strategy) {
        console.warn(`[Strategies] Unknown PROVIDER_STRATEGY="${strategyId}", falling back to strategy 1`);
        return STRATEGY_1;
    }
    return strategy;
}
