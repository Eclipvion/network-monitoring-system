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

export default router;
