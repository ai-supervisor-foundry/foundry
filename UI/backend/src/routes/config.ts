// Config API routes
import { Router } from 'express';
import { config } from '../config.js';
import { getSetting, setSetting, getPool } from '../services/db.js';

const router = Router();

// Configurable settings: key → { envVar, default, label, type, options? }
const CONFIGURABLE_SETTINGS: Record<string, {
  envVar: string; default: string; label: string;
  type: 'select' | 'text' | 'number'; options?: string[];
  description?: string;
}> = {
  provider_strategy: {
    envVar: 'PROVIDER_STRATEGY', default: '1', label: 'Provider Strategy',
    type: 'select', options: ['1', '2', '3'],
    description: '1=Claude-primary, 2=Cursor-primary, 3=Gemini-primary',
  },
  sandbox_root: {
    envVar: 'SANDBOX_ROOT', default: './sandbox', label: 'Sandbox Root',
    type: 'text', description: 'Root directory for project sandboxes',
  },
  ollama_base_url: {
    envVar: 'OLLAMA_BASE_URL', default: 'http://localhost:11434', label: 'Ollama Base URL',
    type: 'text', description: 'Ollama API endpoint for local model inference',
  },
  circuit_breaker_ttl: {
    envVar: 'CIRCUIT_BREAKER_TTL_SECONDS', default: '86400', label: 'Circuit Breaker TTL (s)',
    type: 'number', description: 'Provider circuit breaker cooldown in seconds',
  },
};

// GET /api/config
router.get('/', (req, res) => {
  // Return sanitized config (no sensitive data)
  res.json({
    redis: {
      host: config.redis.host,
      port: config.redis.port,
    },
    supervisor: {
      stateKey: config.supervisor.stateKey,
      queueName: config.supervisor.queueName,
      queueDb: config.supervisor.queueDb,
      stateDb: config.supervisor.stateDb,
      sandboxRoot: config.supervisor.sandboxRoot,
    },
    server: {
      port: config.server.port,
      pollInterval: config.server.pollInterval,
    },
  });
});

// GET /api/config/settings — all configurable settings with source info
router.get('/settings', async (req, res, next) => {
  try {
    const pgSettings = await getSetting('system_settings') || {};
    const result = Object.entries(CONFIGURABLE_SETTINGS).map(([key, def]) => {
      const envVal = process.env[def.envVar];
      const pgVal = pgSettings[key];
      const envOverride = envVal !== undefined;
      const value = envVal ?? pgVal ?? def.default;
      const source: 'env' | 'postgres' | 'default' =
        envOverride ? 'env' : (pgVal !== undefined ? 'postgres' : 'default');
      return {
        key, label: def.label, value, source, type: def.type,
        options: def.options, description: def.description, envOverride,
      };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/config/settings — save a setting to Postgres
router.post('/settings', async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || !CONFIGURABLE_SETTINGS[key]) {
      return res.status(400).json({ error: `Unknown setting: ${key}` });
    }
    const current = await getSetting('system_settings') || {};
    current[key] = value;
    await setSetting('system_settings', current);
    res.json({ key, value, source: 'postgres' });
  } catch (error) {
    next(error);
  }
});

// GET /api/config/strategies — list all strategies
router.get('/strategies', async (_req, res, next) => {
  try {
    const result = await getPool().query('SELECT * FROM strategies ORDER BY id');
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, builtin: r.builtin,
      primary: r.primary_chain, secondary: r.secondary_chain,
    })));
  } catch (error) { next(error); }
});

// POST /api/config/strategies — create a new strategy
router.post('/strategies', async (req, res, next) => {
  try {
    const { id, name, primary, secondary } = req.body;
    if (!id || !name || !primary || !secondary) {
      return res.status(400).json({ error: 'id, name, primary, and secondary are required' });
    }
    // Check id doesn't conflict with builtin
    const existing = await getPool().query('SELECT builtin FROM strategies WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Strategy ID already exists' });
    }
    await getPool().query(
      `INSERT INTO strategies (id, name, builtin, primary_chain, secondary_chain) VALUES ($1, $2, false, $3, $4)`,
      [id, name, JSON.stringify(primary), JSON.stringify(secondary)]
    );
    res.status(201).json({ id, name, builtin: false, primary, secondary });
  } catch (error) { next(error); }
});

// PUT /api/config/strategies/:id — update a strategy
router.put('/strategies/:id', async (req, res, next) => {
  try {
    const { name, primary, secondary } = req.body;
    await getPool().query(
      `UPDATE strategies SET name = COALESCE($1, name), primary_chain = COALESCE($2, primary_chain), secondary_chain = COALESCE($3, secondary_chain), updated_at = NOW() WHERE id = $4`,
      [name || null, primary ? JSON.stringify(primary) : null, secondary ? JSON.stringify(secondary) : null, req.params.id]
    );
    res.json({ success: true });
  } catch (error) { next(error); }
});

// DELETE /api/config/strategies/:id — delete a custom strategy (not builtin)
router.delete('/strategies/:id', async (req, res, next) => {
  try {
    const check = await getPool().query('SELECT builtin FROM strategies WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].builtin) return res.status(403).json({ error: 'Cannot delete built-in strategy' });
    await getPool().query('DELETE FROM strategies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// GET /api/config/execution-modes — list all execution modes (from Postgres)
router.get('/execution-modes', async (_req, res, next) => {
  try {
    const result = await getPool().query('SELECT * FROM execution_modes ORDER BY builtin DESC, created_at ASC');
    res.json(result.rows.map(r => ({
      id: r.id, label: r.label, icon: r.icon, description: r.description, builtin: r.builtin,
      prefill: { tool: r.prefill_tool, agentMode: r.prefill_agent_mode },
      primary: r.primary_chain, secondary: r.secondary_chain,
    })));
  } catch (error) { next(error); }
});

// POST /api/config/execution-modes — create a new execution mode
router.post('/execution-modes', async (req, res, next) => {
  try {
    const { id, label, icon, description, prefill, primary, secondary } = req.body;
    if (!id || !label) return res.status(400).json({ error: 'id and label are required' });
    const existing = await getPool().query('SELECT id FROM execution_modes WHERE id = $1', [id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Execution mode ID already exists' });
    await getPool().query(
      `INSERT INTO execution_modes (id, label, icon, description, builtin, prefill_tool, prefill_agent_mode, primary_chain, secondary_chain)
       VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8)`,
      [id, label, icon || '', description || '', prefill?.tool || '', prefill?.agentMode || '',
       JSON.stringify(primary || []), JSON.stringify(secondary || [])]
    );
    res.status(201).json({ id, label, icon, description, builtin: false, prefill, primary, secondary });
  } catch (error) { next(error); }
});

// PUT /api/config/execution-modes/:id — update an execution mode
router.put('/execution-modes/:id', async (req, res, next) => {
  try {
    const { label, icon, description, prefill, primary, secondary } = req.body;
    await getPool().query(
      `UPDATE execution_modes SET
        label = COALESCE($1, label), icon = COALESCE($2, icon), description = COALESCE($3, description),
        prefill_tool = COALESCE($4, prefill_tool), prefill_agent_mode = COALESCE($5, prefill_agent_mode),
        primary_chain = COALESCE($6, primary_chain), secondary_chain = COALESCE($7, secondary_chain),
        updated_at = NOW()
       WHERE id = $8`,
      [label || null, icon || null, description || null,
       prefill?.tool ?? null, prefill?.agentMode ?? null,
       primary ? JSON.stringify(primary) : null, secondary ? JSON.stringify(secondary) : null,
       req.params.id]
    );
    res.json({ success: true });
  } catch (error) { next(error); }
});

// DELETE /api/config/execution-modes/:id — delete custom execution mode (not builtin)
router.delete('/execution-modes/:id', async (req, res, next) => {
  try {
    const check = await getPool().query('SELECT builtin FROM execution_modes WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].builtin) return res.status(403).json({ error: 'Cannot delete built-in execution mode' });
    await getPool().query('DELETE FROM execution_modes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// GET /api/config/preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const prefs = await getSetting('user_preferences');
    res.json(prefs || { executionMode: 'default', preserveGlobal: false });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/preferences
router.post('/preferences', async (req, res, next) => {
  try {
    const { executionMode, preserveGlobal } = req.body;
    if (executionMode) {
      const modeCheck = await getPool().query('SELECT id FROM execution_modes WHERE id = $1', [executionMode]);
      if (modeCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid execution mode' });
      }
    }
    const current = await getSetting('user_preferences') || {};
    const updated = {
      ...current,
      ...(executionMode !== undefined && { executionMode }),
      ...(preserveGlobal !== undefined && { preserveGlobal }),
    };
    await setSetting('user_preferences', updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;

