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

      CREATE INDEX IF NOT EXISTS audit_log_project_idx ON audit_log(project_id);
      CREATE INDEX IF NOT EXISTS audit_log_task_idx    ON audit_log(task_id);
      CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
    `);
    console.log('Postgres migrations applied');
  } finally {
    client.release();
  }
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
