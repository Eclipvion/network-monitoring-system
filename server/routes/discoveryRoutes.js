import express from 'express';
import networkWatchdog from '../services/discovery/networkWatchdog.js';

const router = express.Router();

// GET /api/discovery/status - Current status of live device watcher
router.get('/status', (req, res) => {
  try {
    const status = networkWatchdog.getWatchdogStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/discovery/trigger-sweep - 1-Click trigger manual sweep immediately
router.post('/trigger-sweep', async (req, res) => {
  try {
    await networkWatchdog.runWatchdogSweep();
    const status = networkWatchdog.getWatchdogStatus();
    res.json({ message: 'Sweep completed successfully', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/discovery/config - Configure auto-add and interval
router.post('/config', (req, res) => {
  try {
    const { enabled, interval } = req.body;
    const updated = networkWatchdog.setWatchdogConfig({ enabled, interval });
    res.json({ message: 'Watchdog configuration updated', config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/discovery/events - Live event logs (Joined & Disconnected)
router.get('/events', (req, res) => {
  try {
    const status = networkWatchdog.getWatchdogStatus();
    res.json(status.recentEvents || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
