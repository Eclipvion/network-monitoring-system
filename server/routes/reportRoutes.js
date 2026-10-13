import express from 'express';
import reportService from '../services/reportService.js';

const router = express.Router();

/**
 * GET /api/reports/analytics
 * Query parameters:
 *  - deviceId: 'all' or device numeric ID
 *  - days: e.g. 1, 3, 7, 14, 30
 *  - from: ISO date string
 *  - to: ISO date string
 *  - type: 'ALL', 'server', 'router', etc.
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await reportService.getReportAnalytics(req.query);
    res.json(analytics);
  } catch (err) {
    console.error('Error fetching report analytics:', err);
    res.status(500).json({ error: err.message || 'Failed to generate report analytics' });
  }
});

/**
 * GET /api/reports/export
 * Query parameters:
 *  - format: 'html' | 'pdf' | 'csv'
 *  - deviceId: 'all' or device ID
 *  - days: number of days
 *  - from: ISO date
 *  - to: ISO date
 */
router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format || 'html').toLowerCase();

    if (format === 'csv') {
      const csv = await reportService.generateMonitoringCsv(req.query);
      const filename = `netpulse-report-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    // Default to HTML (Print-to-PDF ready)
    const html = await reportService.generateMonitoringHtml(req.query);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Error exporting report:', err);
    res.status(500).json({ error: err.message || 'Failed to export report' });
  }
});

export default router;
