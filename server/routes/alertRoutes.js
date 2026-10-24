import express from 'express';
import dataStore from '../services/dataStore.js';
import { broadcastAlertResolved } from '../websocket/socketHandler.js';

const router = express.Router();

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await dataStore.getAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/resolve
router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await dataStore.resolveAlert(id);
    broadcastAlertResolved(resolved);
    res.json(resolved);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/alerts/:id/unresolve - Reopen / mark alert unresolved
router.post('/:id/unresolve', async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await dataStore.unresolveAlert(id);
    res.json(alert);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/alerts/batch-resolve - Bulk resolve multiple alerts
router.post('/batch-resolve', async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of alert IDs is required' });
    }
    const result = await dataStore.bulkResolveAlerts(ids);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/batch-unresolve - Bulk unresolve/reopen multiple alerts
router.post('/batch-unresolve', async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of alert IDs is required' });
    }
    const result = await dataStore.bulkUnresolveAlerts(ids);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/batch-delete - Bulk delete multiple alerts
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of alert IDs is required' });
    }
    const result = await dataStore.deleteAlerts(ids);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/clear-resolved - Clear all resolved history
router.post('/clear-resolved', async (req, res) => {
  try {
    const result = await dataStore.clearResolvedAlerts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:id - Delete a single alert
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataStore.deleteAlert(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
