import express from 'express';
import telemetryService from '../services/telemetryService.js';
import speedTestRoutes from './speedTestRoutes.js';

const router = express.Router();

router.use('/speed-test', speedTestRoutes);

// GET /api/telemetry/bandwidth - Live interface throughput and rolling history
router.get('/bandwidth', (req, res) => {
  try {
    const data = telemetryService.getLiveBandwidth();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telemetry/outages - Outages log, MTTR, and SLA metrics
router.get('/outages', (req, res) => {
  try {
    const data = telemetryService.getOutageAndSlaStats();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
