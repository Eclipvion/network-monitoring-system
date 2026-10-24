import express from 'express';
import speedTestService from '../services/speedTestService.js';

const router = express.Router();

// GET /api/telemetry/speed-test - Get latest result & history
router.get('/', (req, res) => {
  try {
    const history = speedTestService.getHistory(15);
    res.json({
      latest: speedTestService.latestResult,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telemetry/speed-test/run - Execute active speed benchmark
router.post('/run', async (req, res) => {
  try {
    const result = await speedTestService.runSpeedTest();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
