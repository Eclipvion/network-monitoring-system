import express from 'express';
import dataStore from '../services/dataStore.js';
import { sendAlertWebhook } from '../services/webhookService.js';

const router = express.Router();

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await dataStore.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const updated = await dataStore.updateSettings(req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/settings/test-webhook
router.post('/test-webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Valid HTTP/HTTPS Webhook URL is required' });
    }

    await sendAlertWebhook(webhookUrl, {
      title: '🧪 NetPulse NOC - Test Webhook Alert',
      message: 'This is a test notification from your NetPulse Network Monitoring System. Webhook integration is active and working properly!',
      status: 'UP',
      device: 'NetPulse Engine Gateway',
      ip: '127.0.0.1',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Test webhook delivered successfully! Check your Discord / Slack / Webhook channel.'
    });
  } catch (err) {
    res.status(500).json({ error: `Webhook test failed: ${err.message}` });
  }
});

// POST /api/settings/clear-alerts - Auto-resolve orphan/stale alerts
router.post('/clear-alerts', async (req, res) => {
  try {
    const alerts = await dataStore._readJson(dataStore.alertsFile, []);
    const devices = await dataStore.getDevices();
    const devMap = new Map(devices.map(d => [Number(d.id), d]));

    let count = 0;
    const now = new Date().toISOString();
    const cleaned = alerts.map(a => {
      // Resolve if device is deleted, or if device is currently UP
      const dev = devMap.get(Number(a.deviceId));
      if (!a.resolved && (!dev || dev.status === 'UP')) {
        count++;
        return { ...a, resolved: true, resolvedAt: now };
      }
      return a;
    });

    await dataStore._writeJson(dataStore.alertsFile, cleaned);
    res.json({
      success: true,
      resolvedCount: count,
      message: `Cleaned up ${count} stale/orphan alerts successfully.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/backup - Export full JSON configuration
router.get('/backup', async (req, res) => {
  try {
    const settings = await dataStore.getSettings();
    const devices = await dataStore.getDevices();

    const backup = {
      system: 'NetPulse Network Monitoring System',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      devicesCount: devices.length,
      devices
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=netpulse-config-${new Date().toISOString().slice(0, 10)}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/reset - Restore factory defaults
router.post('/reset', async (req, res) => {
  try {
    const defaults = await dataStore.resetSettingsToDefaults();
    res.json({
      success: true,
      message: 'System settings successfully restored to factory defaults.',
      settings: defaults
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/import - Import settings JSON
router.post('/import', async (req, res) => {
  try {
    const payload = req.body;
    const settingsData = payload.settings || payload;
    if (!settingsData || typeof settingsData !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload supplied for import' });
    }
    const updated = await dataStore.updateSettings(settingsData);
    res.json({
      success: true,
      message: 'Settings successfully imported and applied.',
      settings: updated
    });
  } catch (err) {
    res.status(400).json({ error: `Import failed: ${err.message}` });
  }
});

export default router;
