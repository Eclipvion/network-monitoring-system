import express from 'express';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import dataStore from '../services/dataStore.js';
import { broadcastDomainHealthUpdated } from '../websocket/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

import fs from 'fs';

const domainScriptPath = path.resolve(__dirname, '../../python-monitor/domain_health.py');
let pythonExecutable = process.env.PYTHON_PATH || 'C:\\Users\\Ability\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
if (!fs.existsSync(pythonExecutable)) {
  pythonExecutable = 'python';
}

// GET /api/domains - List all domains enriched with latest health & SSL status
router.get('/', async (req, res) => {
  try {
    const domains = await dataStore.getDomainsWithHealth();
    res.json(domains);
  } catch (err) {
    console.error('Error fetching domains:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains - Add new domain for monitoring
router.post('/', async (req, res) => {
  try {
    const { domain, interval, monitoring } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }

    const created = await dataStore.addDomain({
      domain,
      interval: interval ? Number(interval) : 3600,
      monitoring: monitoring !== undefined ? Boolean(monitoring) : true
    });

    // Proactively trigger a health check in background for the new domain
    execFile(
      pythonExecutable,
      [domainScriptPath, created.domain],
      { timeout: 15000 },
      async (err, stdout) => {
        if (!err && stdout) {
          try {
            const checkData = JSON.parse(stdout.trim());
            checkData.domainId = created.id;
            await dataStore.saveDomainHealthResult(checkData);
            broadcastDomainHealthUpdated(checkData);
          } catch (e) {}
        }
      }
    );

    res.status(201).json(created);
  } catch (err) {
    console.error('Error adding domain:', err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/domains/:id - Update domain settings
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateDomain(id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('Error updating domain:', err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/domains/:id - Delete domain
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataStore.deleteDomain(id);
    res.json(result);
  } catch (err) {
    console.error('Error deleting domain:', err);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/domains/:id/history - Get health/latency history for a domain
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 100;
    const history = await dataStore.getDomainHealthHistory(id, limit);
    res.json(history);
  } catch (err) {
    console.error('Error fetching domain history:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains/:id/check-now - Trigger immediate health check for a single domain
router.post('/:id/check-now', async (req, res) => {
  try {
    const { id } = req.params;
    const domain = await dataStore.getDomainById(id);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    execFile(
      pythonExecutable,
      [domainScriptPath, domain.domain],
      { timeout: 20000 },
      async (error, stdout) => {
        if (error) {
          return res.status(500).json({ error: error.message });
        }
        try {
          const result = JSON.parse(stdout.trim());
          result.domainId = domain.id;
          const saved = await dataStore.saveDomainHealthResult(result);
          broadcastDomainHealthUpdated(saved);
          return res.json(saved);
        } catch (e) {
          return res.status(500).json({ error: 'Failed to parse check result' });
        }
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
