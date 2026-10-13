import express from 'express';
import dataStore from '../services/dataStore.js';

const router = express.Router();

/**
 * GET /api/logs
 * Query params: page, limit, deviceId, event, severity, search, from, to
 */
router.get('/', async (req, res) => {
  try {
    const { page, limit, deviceId, event, severity, search, from, to } = req.query;
    const logs = await dataStore.getLogs({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      deviceId,
      event,
      severity,
      search,
      from,
      to
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/logs/export
 * Query params: format ('csv' | 'json'), deviceId, event, severity, search, from, to
 */
router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const { deviceId, event, severity, search, from, to } = req.query;

    const data = await dataStore.getLogsExport({
      format,
      deviceId,
      event,
      severity,
      search,
      from,
      to
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="netpulse-audit-logs-${dateStr}.json"`);
      return res.send(data);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="netpulse-audit-logs-${dateStr}.csv"`);
    return res.send(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to export audit logs' });
  }
});

export default router;
