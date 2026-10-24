import express from 'express';
import dataStore from '../services/dataStore.js';
import {
  PORT_CATALOG,
  probePort,
  auditDevicePorts,
  getSavedAudits,
  getThreatAlerts,
  resolveThreatAlert,
  logDnsTrafficRecord,
  getDnsTrafficRecords,
  clearDnsTrafficLog,
  harvestLiveDnsCache,
  getSecurityOverview,
  getArpGuardAnalysis,
  generateRemediationScript
} from '../services/securityService.js';
import honeypotManager from '../services/honeypotService.js';
import assetGuardRoutes from './assetGuardRoutes.js';

const router = express.Router();

router.use('/asset-guard', assetGuardRoutes);

async function getEnrichedDevices() {
  const [devices, summary] = await Promise.all([
    dataStore.getDevices(),
    dataStore.getDashboardSummary().catch(() => null)
  ]);
  const statusMap = new Map((summary?.devices || []).map((d) => [d.id, d.status]));
  return devices.map((d) => ({
    ...d,
    status: statusMap.get(d.id) || (d.monitoring ? 'PENDING' : 'PAUSED')
  }));
}

// POST /api/security/probe-port - Live test / re-probe a specific port on an IP
router.post('/probe-port', async (req, res) => {
  try {
    const { ip, port } = req.body;
    if (!ip || !port) {
      return res.status(400).json({ error: 'Device IP and port number are required' });
    }
    const cleanHost = String(ip).split(':')[0].trim();
    const probeRes = await probePort(cleanHost, Number(port), 1200);
    res.json({
      host: cleanHost,
      port: Number(port),
      open: probeRes.open,
      testedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error probing port:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/overview - Overall network threat score & stats
router.get('/overview', async (req, res) => {
  try {
    const devices = await getEnrichedDevices();
    const overview = await getSecurityOverview(devices);
    res.json(overview);
  } catch (err) {
    console.error('Error getting security overview:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/ports-catalog - Reference matrix of scanned ports & risks
router.get('/ports-catalog', (req, res) => {
  res.json({
    totalCatalogPorts: PORT_CATALOG.length,
    ports: PORT_CATALOG
  });
});

// GET /api/security/audits - All saved device audits
router.get('/audits', (req, res) => {
  try {
    const audits = getSavedAudits();
    res.json(audits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/scan-device - Audit a specific device
router.post('/scan-device', async (req, res) => {
  try {
    const { deviceId, ip, name } = req.body;
    let targetDevice = { id: deviceId || ip, ip, name: name || ip };

    const devices = await getEnrichedDevices();
    if (deviceId) {
      const found = devices.find((d) => String(d.id) === String(deviceId) || d.ip === ip);
      if (found) targetDevice = found;
    } else if (ip) {
      const found = devices.find((d) => d.ip === ip);
      if (found) targetDevice = found;
    }

    if (!targetDevice.ip) {
      return res.status(400).json({ error: 'Device IP or valid deviceId is required' });
    }

    const report = await auditDevicePorts(targetDevice);
    res.json(report);
  } catch (err) {
    console.error('Error scanning device ports:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/scan-all - Audit all monitored devices
router.post('/scan-all', async (req, res) => {
  try {
    const devices = await getEnrichedDevices();
    if (!devices || devices.length === 0) {
      return res.json({ message: 'No devices registered to scan', results: [] });
    }

    const { scanOffline = false } = req.body || {};

    const onlineDevices = [];
    const offlineDevices = [];

    for (const dev of devices) {
      if (dev.status === 'DOWN' || dev.status === 'PAUSED' || dev.monitoring === false) {
        offlineDevices.push(dev);
      } else {
        onlineDevices.push(dev);
      }
    }

    const results = [];

    // Mark offline devices as OFFLINE without wasting socket timeout time
    for (const dev of offlineDevices) {
      if (scanOffline) {
        onlineDevices.push(dev);
      } else {
        results.push(await auditDevicePorts(dev));
      }
    }

    // Process online devices in parallel chunks of 5
    const chunkSize = 5;
    for (let i = 0; i < onlineDevices.length; i += chunkSize) {
      const chunk = onlineDevices.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((dev) => auditDevicePorts(dev)));
      results.push(...chunkResults);
    }

    const overview = await getSecurityOverview(devices);

    const trulyOnline = results.filter((r) => r.isOnline);
    const trulyOffline = results.filter((r) => !r.isOnline);

    res.json({
      message: `Audited ${trulyOnline.length} active online devices (${trulyOffline.length} offline devices marked as OFFLINE)`,
      totalAudited: results.length,
      onlineAudited: trulyOnline.length,
      offlineSkipped: trulyOffline.length,
      overview,
      results
    });
  } catch (err) {
    console.error('Error scanning all devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/dns-traffic - User web search & DNS queries feed
router.get('/dns-traffic', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const filterLevel = req.query.threatLevel || 'ALL';

    let traffic = getDnsTrafficRecords(limit);
    if (filterLevel !== 'ALL') {
      traffic = traffic.filter((t) => t.threatLevel.toUpperCase() === filterLevel.toUpperCase());
    }

    res.json({
      count: traffic.length,
      traffic
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/dns-harvest - Ingest current local Windows DNS cache
router.post('/dns-harvest', async (req, res) => {
  try {
    const harvested = await harvestLiveDnsCache();
    const traffic = getDnsTrafficRecords(100);
    res.json({
      message: `Harvested ${harvested.length} fresh DNS cache entries`,
      harvestedCount: harvested.length,
      recent: traffic
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/log-dns - Push DNS request from external python/sniffer
router.post('/log-dns', (req, res) => {
  try {
    const { domain, clientIp, queryType } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const logged = logDnsTrafficRecord({ domain, clientIp, queryType });
    res.status(201).json(logged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/security/dns-traffic - Clear traffic history
router.delete('/dns-traffic', (req, res) => {
  try {
    const result = clearDnsTrafficLog();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/threat-alerts - Active security threats & open risks
router.get('/threat-alerts', (req, res) => {
  try {
    const alerts = getThreatAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/resolve-threat - Mark threat alert as acknowledged
router.post('/resolve-threat', (req, res) => {
  try {
    const { threatId } = req.body;
    if (!threatId) {
      return res.status(400).json({ error: 'threatId is required' });
    }
    const result = resolveThreatAlert(threatId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/arp-guard - Layer 2 ARP Table analysis, OUI Vendors, & MITM Detection
router.get('/arp-guard', async (req, res) => {
  try {
    const analysis = await getArpGuardAnalysis();
    res.json(analysis);
  } catch (err) {
    console.error('Error in arp-guard route:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/export-remediation - 1-Click Unified Firewall Lockdown script
router.get('/export-remediation', (req, res) => {
  try {
    const format = req.query.format || 'powershell';
    const isDownload = req.query.download === 'true';
    const result = generateRemediationScript(format);

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Type', result.contentType || 'text/plain');
      return res.send(result.script);
    }

    res.json(result);
  } catch (err) {
    console.error('Error generating remediation script:', err);
    res.status(500).json({ error: err.message });
  }
});

// Honeypot Sensor Endpoints
// GET /api/security/honeypot/status
router.get('/honeypot/status', (req, res) => {
  try {
    const status = honeypotManager.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/honeypot/toggle - Activate or deactivate honeypot
router.post('/honeypot/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    let result;
    if (enabled) {
      result = honeypotManager.start(honeypotManager.config.port, honeypotManager.config.emulatedService);
    } else {
      result = honeypotManager.stop();
    }
    res.json({ ...result, ...honeypotManager.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/honeypot/config - Change honeypot port or emulated service
router.post('/honeypot/config', (req, res) => {
  try {
    const { port, emulatedService } = req.body;
    const cleanPort = Number(port) || honeypotManager.config.port;
    const cleanService = emulatedService || honeypotManager.config.emulatedService;

    honeypotManager.saveConfig({ port: cleanPort, emulatedService: cleanService });
    if (honeypotManager.running) {
      honeypotManager.start(cleanPort, cleanService);
    }

    res.json(honeypotManager.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security/honeypot/logs - Get intrusion hit history
router.get('/honeypot/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = honeypotManager.loadLogs(limit);
    res.json({ count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/security/honeypot/logs - Clear intrusion logs
router.delete('/honeypot/logs', (req, res) => {
  try {
    const result = honeypotManager.clearLogs();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/honeypot/test-probe - Simulate probe locally to test intrusion detection
router.post('/honeypot/test-probe', async (req, res) => {
  try {
    const result = await honeypotManager.simulateProbe();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
