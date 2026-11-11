import express from 'express';
import emailReportService from '../services/emailReportService.js';

const router = express.Router();

// GET /api/reports/email/config - Get current email schedule, recipient list & SMTP config
router.get('/config', (req, res) => {
  try {
    const config = emailReportService.getPublicConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/email/config - Save email schedule, recipient list & SMTP settings
router.post('/config', (req, res) => {
  try {
    const config = emailReportService.saveConfig(req.body);
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/reports/email/test-smtp - Verify SMTP connection & save
router.post('/test-smtp', async (req, res) => {
  try {
    const result = await emailReportService.testConnection(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/reports/email/send-now - Manually dispatch executive SLA report email now
router.post('/send-now', async (req, res) => {
  try {
    const { recipients, days, isTest, config } = req.body || {};
    const result = await emailReportService.sendReportNow({
      recipients,
      days,
      isTest,
      configOverride: config
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/email/send-alerts-report - Dispatch Active & Recent Alerts Report to saved list
router.post('/send-alerts-report', async (req, res) => {
  try {
    const { recipients } = req.body || {};
    const result = await emailReportService.sendAlertsReportNow({ recipients });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/email/send-security-report - Dispatch Cybersecurity & Threat Audit Report to saved list
router.post('/send-security-report', async (req, res) => {
  try {
    const { recipients } = req.body || {};
    const result = await emailReportService.sendSecurityReportNow({ recipients });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/email/send-search-report - Dispatch User Searches & Policy Audit Report to saved list
router.post('/send-search-report', async (req, res) => {
  try {
    const { recipients, deviceIp } = req.body || {};
    const result = await emailReportService.sendUserSearchReportNow({ recipients, deviceIp });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/email/send-ping-report - Dispatch Endpoint Continuous WAN Ping & Outage Report to saved list
router.post('/send-ping-report', async (req, res) => {
  try {
    const { recipients, deviceIp } = req.body || {};
    const result = await emailReportService.sendEndpointPingReportNow({ recipients, deviceIp });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
