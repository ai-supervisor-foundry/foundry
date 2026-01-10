import { Router } from 'express';
import { config } from '../config.js';
import axios from 'axios';
import { exec } from 'child_process';

const router = Router();

// POST /api/ollama/stop
router.post('/stop', (req, res) => {
  console.log('Stopping Ollama service...');
  // Try pkill for user-space process
  exec('pkill -f "ollama serve"', (error, stdout, stderr) => {
    if (error) {
      console.error(`Stop error: ${error}`);
      // Exit code 1 means no process matched, which is effectively "stopped"
      if (error.code === 1) {
         return res.json({ message: 'Ollama was not running' });
      }
      return res.status(500).json({ error: 'Failed to stop Ollama', details: error.message });
    }
    res.json({ message: 'Ollama service stopping...' });
  });
});

// GET /api/ollama/tags (List models)
router.get('/tags', async (req, res, next) => {
  try {
    const response = await axios.get(`${config.ollama.baseUrl}/api/tags`);
    res.json(response.data);
  } catch (error) {
    console.error('Ollama Error:', error);
    res.status(503).json({ error: 'Ollama service unreachable', details: String(error) });
  }
});

// GET /api/ollama/version
router.get('/version', async (req, res, next) => {
  try {
    const response = await axios.get(`${config.ollama.baseUrl}/api/version`);
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ error: 'Ollama service unreachable' });
  }
});

export default router;
