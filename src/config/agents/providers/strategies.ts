import { Provider } from "../../../domain/agents/enums/provider";
import pg from 'pg';

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

let pgPool: pg.Pool | null = null;

function getPgPool(): pg.Pool {
    if (!pgPool) {
        pgPool = new pg.Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5433', 10),
            user: process.env.PG_USER || 'supervisor',
            password: process.env.PG_PASSWORD || 'supervisor',
            database: process.env.PG_DATABASE || 'supervisor',
            max: 3,
            connectionTimeoutMillis: 3000,
        });
        pgPool.on('error', () => { /* silent — Postgres is optional for strategies */ });
    }
    return pgPool;
}

/**
 * Returns the active strategy. Reads from .env first, then Postgres settings,
 * then falls back to hardcoded default '1'. Custom strategies can be stored in
 * the Postgres `strategies` table.
 */
export async function getActiveStrategy(): Promise<ProviderStrategy> {
    // 1. Determine strategy ID: .env > Postgres settings > default '1'
    let strategyId: string = process.env.PROVIDER_STRATEGY || '';
    if (!strategyId) {
        try {
            const result = await getPgPool().query(
                "SELECT value->>'provider_strategy' as sid FROM settings WHERE key = 'system_settings'"
            );
            strategyId = result.rows[0]?.sid || '1';
        } catch {
            strategyId = '1';
        }
    }

    // 2. Look up strategy: hardcoded first, then Postgres
    const hardcoded = STRATEGIES[strategyId];
    if (hardcoded) return hardcoded;

    // Try custom strategy from Postgres
    try {
        const result = await getPgPool().query(
            'SELECT primary_chain, secondary_chain, name FROM strategies WHERE id = $1',
            [strategyId]
        );
        if (result.rows[0]) {
            const row = result.rows[0];
            return {
                name: row.name,
                primary: (row.primary_chain as any[]).map(e => ({
                    provider: e.provider as Provider,
                    agentMode: e.agentMode,
                })),
                secondary: (row.secondary_chain as any[]).map(e => ({
                    provider: e.provider as Provider,
                    agentMode: e.agentMode,
                })),
            };
        }
    } catch {
        // Postgres unavailable
    }

    console.warn(`[Strategies] Unknown PROVIDER_STRATEGY="${strategyId}", falling back to strategy 1`);
    return STRATEGY_1;
}

/** Synchronous fallback — reads only from env + hardcoded strategies, no Postgres. */
export function getActiveStrategySync(): ProviderStrategy {
    const strategyId = process.env.PROVIDER_STRATEGY || '1';
    const strategy = STRATEGIES[strategyId];
    if (!strategy) {
        console.warn(`[Strategies] Unknown PROVIDER_STRATEGY="${strategyId}", falling back to strategy 1`);
        return STRATEGY_1;
    }
    return strategy;
}
