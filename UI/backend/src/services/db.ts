// PostgreSQL connection pool and schema migrations
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('Postgres pool error:', err);
    });
  }
  return pool;
}

/**
 * Run schema migrations — idempotent, safe to call on every startup.
 */
export async function runMigrations(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL,
        git_url     TEXT,
        branch      TEXT,
        status      TEXT NOT NULL DEFAULT 'active',
        registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id                  TEXT PRIMARY KEY,
        project_id          TEXT REFERENCES projects(id) ON DELETE SET NULL,
        title               TEXT NOT NULL,
        description         TEXT,
        acceptance_criteria TEXT,
        status              TEXT NOT NULL DEFAULT 'pending',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_runs (
        id          BIGSERIAL PRIMARY KEY,
        task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        outcome     TEXT,
        error       TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id          BIGSERIAL PRIMARY KEY,
        event_type  TEXT NOT NULL,
        project_id  TEXT,
        task_id     TEXT,
        payload     JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       JSONB NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        builtin BOOLEAN NOT NULL DEFAULT false,
        primary_chain JSONB NOT NULL,
        secondary_chain JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS execution_modes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        builtin BOOLEAN NOT NULL DEFAULT false,
        prefill_tool TEXT NOT NULL DEFAULT '',
        prefill_agent_mode TEXT NOT NULL DEFAULT '',
        primary_chain JSONB NOT NULL DEFAULT '[]',
        secondary_chain JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS audit_log_project_idx ON audit_log(project_id);
      CREATE INDEX IF NOT EXISTS audit_log_task_idx    ON audit_log(task_id);
      CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
    `);
    console.log('Postgres migrations applied');
    await seedDefaults();
  } finally {
    client.release();
  }
}

/**
 * Get a setting by key, returns null if not found.
 */
export async function getSetting(key: string): Promise<any> {
  const result = await getPool().query(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value ?? null;
}

/**
 * Upsert a setting by key.
 */
export async function setSetting(key: string, value: any): Promise<void> {
  await getPool().query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

/**
 * Append a row to audit_log (fire-and-forget safe).
 */
export async function writeAuditLog(
  eventType: string,
  opts: { projectId?: string; taskId?: string; payload?: object } = {}
): Promise<void> {
  await getPool().query(
    `INSERT INTO audit_log (event_type, project_id, task_id, payload)
     VALUES ($1, $2, $3, $4)`,
    [eventType, opts.projectId ?? null, opts.taskId ?? null, opts.payload ? JSON.stringify(opts.payload) : null]
  );
}

/**
 * Seed built-in strategies and execution modes on first startup.
 * Idempotent — skips if already seeded (checks settings.initial_setup_done).
 */
export async function seedDefaults(): Promise<void> {
  const done = await getSetting('initial_setup_done');
  if (done) return;

  const client = await getPool().connect();
  try {
    // Seed built-in strategies
    const strategies = [
      {
        id: '1', name: 'claude-primary', builtin: true,
        primary: [
          { provider: 'claude', agentMode: 'auto' },
          { provider: 'cursor', agentMode: 'auto' },
          { provider: 'gemini', agentMode: 'auto' },
        ],
        secondary: [
          { provider: 'cursor', agentMode: 'auto' },
          { provider: 'gemini', agentMode: 'auto' },
          { provider: 'ollama', agentMode: 'phi4-mini' },
        ],
      },
      {
        id: '2', name: 'cursor-primary', builtin: true,
        primary: [
          { provider: 'cursor', agentMode: 'auto' },
          { provider: 'gemini', agentMode: 'auto' },
          { provider: 'claude', agentMode: 'auto' },
        ],
        secondary: [
          { provider: 'gemini', agentMode: 'auto' },
          { provider: 'ollama', agentMode: 'phi4-mini' },
          { provider: 'claude', agentMode: 'auto' },
        ],
      },
      {
        id: '3', name: 'gemini-primary', builtin: true,
        primary: [
          { provider: 'gemini', agentMode: 'auto' },
          { provider: 'claude', agentMode: 'auto' },
          { provider: 'cursor', agentMode: 'auto' },
        ],
        secondary: [
          { provider: 'cursor', agentMode: 'auto' },
          { provider: 'gemini', agentMode: 'gemini-2.5-flash-lite' },
          { provider: 'claude', agentMode: 'auto' },
          { provider: 'ollama', agentMode: 'phi4-mini' },
        ],
      },
    ];

    for (const s of strategies) {
      await client.query(
        `INSERT INTO strategies (id, name, builtin, primary_chain, secondary_chain)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.builtin, JSON.stringify(s.primary), JSON.stringify(s.secondary)]
      );
    }

    // Seed built-in execution modes
    const modes = [
      {
        id: 'default', label: 'Default', icon: '\u2699',
        description: 'Uses the active provider strategy as-is. No provider/model override.',
        builtin: true, prefill_tool: '', prefill_agent_mode: '',
        primary: [] as { provider: string; agentMode: string }[], secondary: [] as { provider: string; agentMode: string }[],
      },
      {
        id: 'normal', label: 'Normal', icon: '\u25B6',
        description: 'Standard operations. Primary: Claude Sonnet, Cursor Composer 2, Gemini 2.5 Pro.',
        builtin: true, prefill_tool: 'claude', prefill_agent_mode: 'claude-sonnet-4-6',
        primary: [
          { provider: 'claude', agentMode: 'claude-sonnet-4-6' },
          { provider: 'cursor', agentMode: 'composer-2' },
          { provider: 'gemini', agentMode: 'gemini-2.5-pro' },
        ],
        secondary: [
          { provider: 'cursor', agentMode: 'composer-2' },
          { provider: 'gemini', agentMode: 'gemini-2.5-flash' },
          { provider: 'ollama', agentMode: 'phi4-mini' },
        ],
      },
      {
        id: 'thinking', label: 'Thinking', icon: '\uD83E\uDDE0',
        description: 'Reasoning & analysis. Primary: Claude Opus, Cursor Opus, Gemini 3.1 Pro Preview.',
        builtin: true, prefill_tool: 'claude', prefill_agent_mode: 'claude-opus-4-6',
        primary: [
          { provider: 'claude', agentMode: 'claude-opus-4-6' },
          { provider: 'cursor', agentMode: 'claude-opus-4-6' },
          { provider: 'gemini', agentMode: 'gemini-3.1-pro-preview' },
        ],
        secondary: [
          { provider: 'gemini', agentMode: 'gemini-3.1-flash-preview' },
        ],
      },
      {
        id: 'savings', label: 'Savings', icon: '\uD83D\uDCB0',
        description: 'Low-cost runs via Cursor Composer tier. Operator may override.',
        builtin: true, prefill_tool: 'cursor', prefill_agent_mode: 'composer-2',
        primary: [
          { provider: 'cursor', agentMode: 'composer-2' },
        ],
        secondary: [
          { provider: 'cursor', agentMode: 'composer-2' },
        ],
      },
    ];

    for (const m of modes) {
      await client.query(
        `INSERT INTO execution_modes (id, label, icon, description, builtin, prefill_tool, prefill_agent_mode, primary_chain, secondary_chain)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.label, m.icon, m.description, m.builtin, m.prefill_tool, m.prefill_agent_mode, JSON.stringify(m.primary), JSON.stringify(m.secondary)]
      );
    }

    // Seed default system settings
    await setSetting('system_settings', { provider_strategy: '1' });
    await setSetting('initial_setup_done', true);
    console.log('Initial setup: defaults seeded into Postgres');
  } finally {
    client.release();
  }
}
