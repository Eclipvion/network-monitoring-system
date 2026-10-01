import express from 'express';
import dataStore from '../services/dataStore.js';

const router = express.Router();

// GET /api/logs?page=&limit=&deviceId=&event=
router.get('/', async (req, res) => {
  try {
    const { page, limit, deviceId, event } = req.query;
    const logs = await dataStore.getLogs({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      deviceId,
      event
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
