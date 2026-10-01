import express from 'express';
import dataStore from '../services/dataStore.js';

const router = express.Router();

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const summary = await dataStore.getDashboardSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
