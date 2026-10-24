import express from 'express';
import emailReportService from '../services/emailReportService.js';

const router = express.Router();

// GET /api/reports/email/config - Get current email schedule & SMTP config
router.get('/config', (req, res) => {
  try {
    const config = emailReportService.getPublicConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/email/config - Save email schedule & SMTP settings
router.post('/config', (req, res) => {
  try {
    const config = emailReportService.saveConfig(req.body);
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/reports/email/test-smtp - Verify SMTP connection
router.post('/test-smtp', async (req, res) => {
  try {
    const result = await emailReportService.testConnection(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/reports/email/send-now - Manually dispatch executive report email now
router.post('/send-now', async (req, res) => {
  try {
    const { recipients, days, isTest } = req.body;
    const result = await emailReportService.sendReportNow({ recipients, days, isTest });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
