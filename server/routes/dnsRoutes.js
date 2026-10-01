import express from 'express';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import dataStore from '../services/dataStore.js';
import { broadcastDnsUpdated } from '../websocket/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const dnsScriptPath = path.resolve(__dirname, '../../python-monitor/dns_check.py');
const pythonExecutable = process.env.PYTHON_PATH || 'C:\\Users\\Ability\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

// GET /api/dns/results - List recent DNS benchmark results
router.get('/results', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const results = await dataStore.getDnsResults(limit);
    res.json(results);
  } catch (err) {
    console.error('Error fetching DNS results:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dns/summary - Aggregated benchmark stats per resolver
router.get('/summary', async (req, res) => {
  try {
    const summary = await dataStore.getDnsSummary();
    res.json(summary);
  } catch (err) {
    console.error('Error fetching DNS summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dns/result - Post a new benchmark result from Python worker
router.post('/result', async (req, res) => {
  try {
    const { resolver, resolverName, domain, resolutionTimeMs, success, timestamp } = req.body;
    if (!resolver || !domain) {
      return res.status(400).json({ error: 'resolver and domain are required' });
    }

    const saved = await dataStore.saveDnsResult({
      resolver,
      resolverName,
      domain,
      resolutionTimeMs,
      success,
      timestamp
    });

    // Broadcast live event to clients
    broadcastDnsUpdated(saved);

    res.status(201).json(saved);
  } catch (err) {
    console.error('Error saving DNS result:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dns/test-now - Trigger an immediate DNS benchmark cycle
router.post('/test-now', async (req, res) => {
  try {
    execFile(
      pythonExecutable,
      [dnsScriptPath, '--once'],
      { timeout: 30000 },
      async (error, stdout, stderr) => {
        if (error) {
          console.warn('DNS manual benchmark notice:', error.message);
        }
        // Fetch fresh summary and return
        const summary = await dataStore.getDnsSummary();
        return res.json({ success: true, summary });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
