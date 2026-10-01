import express from 'express';
import dataStore from '../services/dataStore.js';
import { broadcastDeviceStatus } from '../websocket/socketHandler.js';

const router = express.Router();

// GET /api/devices
router.get('/', async (req, res) => {
  try {
    const devices = await dataStore.getDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices
router.post('/', async (req, res) => {
  try {
    const { name, ip, type, interval, monitoring } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: 'Name and IP are required fields' });
    }

    const newDevice = await dataStore.addDevice({ name, ip, type, interval, monitoring });
    res.status(201).json(newDevice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/devices/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateDevice(id, req.body);
    
    // Broadcast status change if monitoring was toggled
    const currentStatus = await dataStore.getDeviceStatus(id);
    if (currentStatus) {
      broadcastDeviceStatus({
        deviceId: Number(id),
        status: currentStatus.status,
        latency: currentStatus.latency,
        packetLoss: currentStatus.packetLoss,
        timestamp: new Date().toISOString(),
        message: currentStatus.message
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/devices/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dataStore.deleteDevice(id);
    res.json({ message: 'Device deleted successfully', device: deleted });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/devices/:id/status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await dataStore.getDeviceStatus(id);
    if (!status) {
      return res.status(404).json({ error: `Device ${id} not found` });
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices/:id/history?range=1h|24h|7d
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const range = req.query.range || '24h';
    const history = await dataStore.getDeviceHistory(id, range);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
