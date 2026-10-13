import express from 'express';
import os from 'os';
import path from 'path';
import net from 'net';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import dataStore from '../services/dataStore.js';
import { broadcastDeviceStatus } from '../websocket/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

import fs from 'fs';

const scannerScriptPath = path.resolve(__dirname, '../../python-monitor/scanner.py');
let pythonExecutable = process.env.PYTHON_PATH || 'C:\\Users\\Ability\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
if (!fs.existsSync(pythonExecutable)) {
  pythonExecutable = 'python';
}

function detectLocalSubnet() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
          return {
            localIp: iface.address,
            netmask: iface.netmask,
            subnet: `${base}.0/24`,
            startIp: `${base}.1`,
            endIp: `${base}.254`
          };
        }
      }
    }
  }
  return { localIp: '192.168.1.1', subnet: '192.168.1.0/24', startIp: '192.168.1.1', endIp: '192.168.1.254' };
}

// GET /api/devices/network-info - Detect local subnet and adapter info
router.get('/network-info', (req, res) => {
  try {
    const info = detectLocalSubnet();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/scan-network - Run multi-threaded network discovery
router.post('/scan-network', async (req, res) => {
  try {
    const { startIp, endIp, subnet } = req.body;
    const args = [scannerScriptPath];
    if (startIp && endIp) {
      args.push('--start', startIp, '--end', endIp);
    } else if (subnet) {
      args.push('--subnet', subnet);
    }

    execFile(
      pythonExecutable,
      args,
      { timeout: 60000, maxBuffer: 1024 * 1024 * 5 },
      async (error, stdout, stderr) => {
        let scanResult;
        try {
          if (stdout) {
            scanResult = JSON.parse(stdout.trim());
          }
        } catch (e) {
          console.error('Failed to parse scanner output:', e, stdout);
        }

        if (!scanResult) {
          return res.status(500).json({ error: error ? error.message : 'Network scan failed' });
        }

        // Cross-reference with existing devices
        const existingDevices = await dataStore.getDevices();
        const existingIpMap = new Map(existingDevices.map(d => [d.ip.toLowerCase(), d]));

        const enrichedDevices = (scanResult.devices || []).map(d => {
          const matched = existingIpMap.get(d.ip.toLowerCase()) || 
                          existingIpMap.get(`${d.ip}:443`.toLowerCase()) ||
                          existingIpMap.get(`${d.ip}:80`.toLowerCase());
          return {
            ...d,
            alreadyAdded: Boolean(matched),
            existingDevice: matched || null
          };
        });

        res.json({
          ...scanResult,
          devices: enrichedDevices
        });
      }
    );
  } catch (err) {
    console.error('Error scanning network:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/batch-add - Batch import discovered devices
router.post('/batch-add', async (req, res) => {
  try {
    const { devices } = req.body;
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ error: 'devices array is required' });
    }

    const added = await dataStore.batchAddDevices(devices);
    res.status(201).json({
      message: `Successfully added ${added.length} devices`,
      added
    });
  } catch (err) {
    console.error('Error batch adding devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/ping-test - Instant live connection test before saving
router.post('/ping-test', async (req, res) => {
  const { target, port, method = 'auto' } = req.body;
  if (!target) return res.status(400).json({ error: 'target is required' });

  let rawTarget = target.trim();
  let host = rawTarget;
  let parsedPort = port ? Number(port) : null;

  if (rawTarget.includes(':') && !rawTarget.startsWith('[')) {
    const parts = rawTarget.split(':');
    host = parts[0];
    parsedPort = Number(parts[1]);
  }

  const start = Date.now();

  // If TCP port is specified or method is tcp
  if (parsedPort || method === 'tcp') {
    const testPort = parsedPort || 443;
    const socket = new net.Socket();
    socket.setTimeout(2500);

    socket.connect(testPort, host, () => {
      const latency = Date.now() - start;
      socket.destroy();
      return res.json({
        success: true,
        latency,
        status: 'UP',
        method: `TCP Port ${testPort}`,
        message: `Connected successfully in ${latency}ms`
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      return res.json({
        success: false,
        latency: null,
        status: 'DOWN',
        method: `TCP Port ${testPort}`,
        message: `Connection failed: ${err.message}`
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      return res.json({
        success: false,
        latency: null,
        status: 'DOWN',
        method: `TCP Port ${testPort}`,
        message: 'Connection timed out (2500ms)'
      });
    });
  } else {
    // System ICMP ping probe
    const isWindows = process.platform === 'win32';
    const pingCmd = isWindows ? 'ping' : 'ping';
    const pingArgs = isWindows ? ['-4', '-n', '1', '-w', '1500', host] : ['-c', '1', '-W', '2', host];

    execFile(pingCmd, pingArgs, { timeout: 3000 }, (err, stdout) => {
      const latencyMatch = stdout ? stdout.match(/time[=<]\s*([0-9.]+)\s*ms/i) : null;
      if (!err && latencyMatch) {
        return res.json({
          success: true,
          latency: parseFloat(latencyMatch[1]),
          status: 'UP',
          method: 'ICMP Ping',
          message: `Host replied in ${latencyMatch[1]}ms`
        });
      }

      // If ICMP ping failed, try fallback to TCP port 443 (like Azure/web)
      const sock = new net.Socket();
      sock.setTimeout(2000);
      sock.connect(443, host, () => {
        const latency = Date.now() - start;
        sock.destroy();
        return res.json({
          success: true,
          latency,
          status: 'UP',
          method: 'TCP 443 Fallback',
          message: `ICMP blocked, but TCP 443 connected in ${latency}ms`
        });
      });
      sock.on('error', () => {
        sock.destroy();
        return res.json({
          success: false,
          latency: null,
          status: 'DOWN',
          method: 'ICMP Ping',
          message: 'Destination Host Unreachable / Ping Timeout'
        });
      });
      sock.on('timeout', () => {
        sock.destroy();
        return res.json({
          success: false,
          latency: null,
          status: 'DOWN',
          method: 'ICMP Ping',
          message: 'Destination Host Unreachable (Timeout)'
        });
      });
    });
  }
});

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

// POST /api/devices/:id/ping-now - Instant on-demand re-check of device status
router.post('/:id/ping-now', async (req, res) => {
  try {
    const { id } = req.params;
    const device = await dataStore.getDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: `Device ${id} not found` });
    }

    const host = device.ip.trim();
    const isWindows = process.platform === 'win32';
    const pingCmd = isWindows ? 'ping' : 'ping';
    const pingArgs = isWindows ? ['-4', '-n', '1', '-w', '1500', host] : ['-c', '1', '-W', '2', host];

    execFile(pingCmd, pingArgs, { timeout: 3000 }, async (err, stdout) => {
      let latency = null;
      let status = 'DOWN';
      let message = 'Ping failed: Destination Host Unreachable';
      let packetLoss = 100;

      const latencyMatch = stdout ? stdout.match(/time[=<]\s*([0-9.]+)\s*ms/i) : null;
      if (!err && latencyMatch) {
        latency = parseFloat(latencyMatch[1]);
        status = latency > 150 ? 'WARNING' : 'UP';
        packetLoss = 0;
        message = `OK: ${latency}ms, 0% loss`;
      } else {
        // Fallback TCP 443
        const start = Date.now();
        const testPort = host.includes(':') ? parseInt(host.split(':')[1], 10) : 443;
        const cleanHost = host.includes(':') ? host.split(':')[0] : host;

        await new Promise((resolve) => {
          const sock = new net.Socket();
          sock.setTimeout(2000);
          sock.connect(testPort, cleanHost, () => {
            latency = Date.now() - start;
            status = latency > 150 ? 'WARNING' : 'UP';
            packetLoss = 0;
            message = `OK (TCP ${testPort}): ${latency}ms, 0% loss`;
            sock.destroy();
            resolve();
          });
          sock.on('error', () => { sock.destroy(); resolve(); });
          sock.on('timeout', () => { sock.destroy(); resolve(); });
        });
      }

      const timestamp = new Date().toISOString();
      const savedResult = await dataStore.saveMonitoringResult({
        deviceId: Number(id),
        timestamp,
        status,
        latency,
        packetLoss,
        message
      });

      broadcastDeviceStatus({
        deviceId: Number(id),
        status,
        latency,
        packetLoss,
        timestamp,
        message
      });

      res.json({
        success: true,
        deviceId: Number(id),
        status,
        latency,
        packetLoss,
        message,
        timestamp
      });
    });
  } catch (err) {
    console.error('Error executing ping-now:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
