import express from 'express';
import dataStore from '../services/dataStore.js';
import {
  broadcastDeviceStatus,
  broadcastNewAlert,
  broadcastAlertResolved
} from '../websocket/socketHandler.js';

import reportService from '../services/reportService.js';

const router = express.Router();

// GET /api/monitoring/export?format=csv&type=&status=&from=&to=
router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();

    if (format === 'html' || format === 'pdf') {
      const html = await reportService.generateMonitoringHtml(req.query);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // Default to CSV
    const csv = await reportService.generateMonitoringCsv(req.query);
    const filename = `network-monitoring-report-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('Error generating monitoring export:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitoring/result
router.post('/result', async (req, res) => {
  try {
    const { deviceId, status, latency, packetLoss, jitter, message, timestamp, trafficIn, trafficOut } = req.body;

    if (deviceId === undefined || !status) {
      return res.status(400).json({ error: 'deviceId and status are required fields' });
    }

    const { result, device, newAlert, resolvedAlerts } = await dataStore.saveMonitoringResult({
      deviceId: Number(deviceId),
      status,
      latency: latency !== undefined ? Number(latency) : null,
      packetLoss: packetLoss !== undefined ? Number(packetLoss) : 0,
      jitter: jitter !== undefined ? Number(jitter) : undefined,
      trafficIn: trafficIn !== undefined ? Number(trafficIn) : undefined,
      trafficOut: trafficOut !== undefined ? Number(trafficOut) : undefined,
      message,
      timestamp
    });

    // Broadcast real-time status update to all connected clients
    broadcastDeviceStatus({
      deviceId: result.deviceId,
      name: device.name,
      ip: device.ip,
      status: result.status,
      latency: result.latency,
      packetLoss: result.packetLoss,
      jitter: result.jitter,
      trafficIn: result.trafficIn,
      trafficOut: result.trafficOut,
      speedMbps: result.speedMbps,
      timestamp: result.timestamp,
      message: result.message
    });

    // Broadcast new alert if triggered
    if (newAlert) {
      broadcastNewAlert(newAlert);
    }

    // Broadcast resolved alerts if any
    if (resolvedAlerts && resolvedAlerts.length > 0) {
      for (const resolved of resolvedAlerts) {
        broadcastAlertResolved(resolved);
      }
    }

    res.status(201).json({
      success: true,
      result,
      newAlert,
      resolvedCount: resolvedAlerts ? resolvedAlerts.length : 0
    });
  } catch (err) {
    console.error('Error handling monitoring result:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
