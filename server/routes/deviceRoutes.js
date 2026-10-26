import express from 'express';
import os from 'os';
import path from 'path';
import net from 'net';
import { execFile, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dataStore from '../services/dataStore.js';
import { broadcastDeviceStatus } from '../websocket/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

import fs from 'fs';

function findScannerScript() {
  const candidates = [
    path.resolve(__dirname, '../../python-monitor/scanner.py'),
    path.resolve(__dirname, '../python-monitor/scanner.py'),
    path.resolve(process.cwd(), 'python-monitor/scanner.py'),
    path.resolve(__dirname, 'python-monitor/scanner.py')
  ];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

const scannerScriptPath = findScannerScript();
const venvPython = path.resolve(__dirname, '../../.venv/Scripts/python.exe');

let pythonExecutable = process.env.PYTHON_PATH || 'C:\\Users\\Ability\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
if (fs.existsSync(venvPython)) {
  pythonExecutable = venvPython;
} else if (!fs.existsSync(pythonExecutable)) {
  pythonExecutable = 'python';
}

function getSystemDefaultGateway() {
  try {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const out = execSync('route print 0.0.0.0', { timeout: 1200 }).toString();
      const lines = out.split('\n');
      for (const l of lines) {
        const m = l.trim().match(/^0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/);
        if (m && m[1] && m[1] !== '0.0.0.0' && !m[1].startsWith('127.')) {
          return m[1];
        }
      }
    }
  } catch (_) {}
  return null;
}

function detectLocalSubnet() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  const gateway = getSystemDefaultGateway();

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vethernet|virtual|vmware|wsl|hyper-v|loopback/i.test(name);
    const isPreferred = /wi-fi|wlan|ethernet|local area connection/i.test(name);

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
          candidates.push({
            name,
            score: (isPreferred ? 10 : 0) - (isVirtual ? 10 : 0),
            localIp: iface.address,
            netmask: iface.netmask,
            subnet: `${base}.0/24`,
            startIp: `${base}.1`,
            endIp: `${base}.254`,
            gateway: gateway || `${base}.1`
          });
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Sort highest score first
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  const fallbackGw = gateway || '192.168.46.1';
  const gwBase = fallbackGw.split('.').slice(0, 3).join('.');
  return {
    localIp: `${gwBase}.100`,
    subnet: `${gwBase}.0/24`,
    startIp: `${gwBase}.1`,
    endIp: `${gwBase}.254`,
    gateway: fallbackGw
  };
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

// GET /api/devices/public-ip - Detect live public WAN IP & ISP details
router.get('/public-ip', async (req, res) => {
  try {
    const https = await import('https');
    const http = await import('http');

    const publicIp = await new Promise((resolve) => {
      const request = https.default.get('https://api.ipify.org?format=json', { timeout: 3500 }, (resp) => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => {
          try { resolve(JSON.parse(d).ip); } catch (e) { resolve(null); }
        });
      });
      request.on('error', () => resolve(null));
      request.on('timeout', () => { request.destroy(); resolve(null); });
    });

    let ispInfo = null;
    if (publicIp) {
      ispInfo = await new Promise((resolve) => {
        const reqApi = http.default.get(`http://ip-api.com/json/${publicIp}`, { timeout: 3500 }, (resp) => {
          let d = '';
          resp.on('data', c => d += c);
          resp.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
          });
        });
        reqApi.on('error', () => resolve(null));
        reqApi.on('timeout', () => { reqApi.destroy(); resolve(null); });
      });
    }

    res.json({
      ip: publicIp || 'Unknown',
      isp: ispInfo?.isp || ispInfo?.org || 'Public Internet',
      org: ispInfo?.org || '',
      country: ispInfo?.country || 'Pakistan',
      city: ispInfo?.city || '',
      as: ispInfo?.as || '',
      poolSuggestion: publicIp ? `${publicIp.split('.').slice(0, 3).join('.')}.0/24` : ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Native Node.js ARP & Subnet Discovery Fallback
async function nativeScanSubnet(startIp, endIp, subnet) {
  const isWindows = process.platform === 'win32';
  const devices = [];

  const ipToLong = (ip) => {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  };

  let startNum = 0;
  let endNum = 0;
  let baseSubnet = subnet || '';

  if (startIp && endIp) {
    startNum = ipToLong(startIp);
    endNum = ipToLong(endIp);
  } else if (subnet) {
    const [subIp, mask] = subnet.split('/');
    const prefix = parseInt(mask || '24', 10);
    const ipL = ipToLong(subIp);
    const maskL = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    startNum = (ipL & maskL) + 1;
    endNum = (startNum | (~maskL >>> 0)) - 1;
  }

  try {
    const arpCmd = isWindows ? 'arp -a' : 'arp -n';
    const arpOutput = execSync(arpCmd, { timeout: 4000 }).toString();
    const lines = arpOutput.split('\n');

    const seenIps = new Set();
    const gateway = getSystemDefaultGateway();

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F[:-]+)\s+(dynamic|static)/i);
      if (match) {
        const ip = match[1];
        const rawMac = match[2].toLowerCase().replace(/-/g, ':');
        const lastOctet = parseInt(ip.split('.')[3], 10);

        if (lastOctet === 255 || lastOctet === 0) continue;
        if (ip.startsWith('224.') || ip.startsWith('239.') || ip === '255.255.255.255') continue;
        if (rawMac === 'ff:ff:ff:ff:ff:ff' || rawMac.startsWith('01:00:5e')) continue;

        const ipNum = ipToLong(ip);
        if (startNum && endNum && (ipNum < startNum || ipNum > endNum)) {
          continue;
        }

        if (seenIps.has(ip)) continue;
        seenIps.add(ip);

        let type = 'workstation';
        let vendor = 'LAN Host';

        if (ip === gateway || lastOctet === 1) {
          type = 'router';
          vendor = 'Gateway / Perimeter';
        } else if (rawMac.startsWith('00:0c:29') || rawMac.startsWith('00:50:56') || rawMac.startsWith('08:00:27')) {
          type = 'server';
          vendor = 'VMware / Server Host';
        } else if (rawMac.startsWith('dc:2c:6e') || rawMac.startsWith('d0:05:e4') || rawMac.startsWith('00:1a:2b')) {
          type = 'router';
          vendor = 'Networking Hardware';
        } else if (rawMac.startsWith('7c:7b:1c') || rawMac.startsWith('bc:54:2f') || rawMac.startsWith('80:79:5d') || rawMac.startsWith('b0:19:21')) {
          type = 'mobile';
          vendor = 'Mobile / Handset';
        }

        devices.push({
          ip,
          mac: rawMac.toUpperCase(),
          vendor,
          hostname: ip === gateway ? 'Default Gateway' : `LAN Device (${ip})`,
          type,
          latency: 1.8,
          method: 'ARP Table',
          status: 'UP'
        });
      }
    }
  } catch (err) {
    console.error('Error during native ARP scan:', err);
  }

  devices.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));

  return {
    subnet: baseSubnet || (startIp ? `${startIp.split('.').slice(0, 3).join('.')}.0/24` : '172.18.1.0/24'),
    scannedRange: startIp && endIp ? `${startIp} - ${endIp}` : `${devices[0]?.ip || '172.18.1.1'} - ${devices[devices.length - 1]?.ip || '172.18.1.254'}`,
    totalHosts: 254,
    aliveCount: devices.length,
    devices
  };
}

// POST /api/devices/scan-network - Run multi-threaded network discovery
router.post('/scan-network', async (req, res) => {
  try {
    const { startIp, endIp, subnet } = req.body;

    const runNativeFallback = async () => {
      const scanResult = await nativeScanSubnet(startIp, endIp, subnet);
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

      return res.json({
        ...scanResult,
        devices: enrichedDevices
      });
    };

    // If scanner.py does not exist on disk, seamlessly use native Node.js scanner
    if (!fs.existsSync(scannerScriptPath)) {
      console.log('[Scanner] scanner.py not found on disk, using native ARP discovery');
      return await runNativeFallback();
    }

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
          console.error('Failed to parse scanner output, falling back to native scan:', e);
        }

        // If python failed, threw error, or script was missing, gracefully use native discovery!
        if (!scanResult) {
          console.log('[Scanner] Python scan unavailable or failed, falling back to native scan');
          return await runNativeFallback();
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

    // Trigger immediate background sweep for all newly added devices
    setTimeout(() => {
      import('../services/backgroundMonitor.js')
        .then(m => m.runMonitoringSweep())
        .catch(() => {});
    }, 150);
  } catch (err) {
    console.error('Error batch adding devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/batch-delete - Batch delete devices
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }

    const result = await dataStore.deleteDevices(ids);
    res.json({
      message: `Successfully deleted ${result.deletedCount} devices`,
      deletedCount: result.deletedCount,
      devices: result.removed
    });
  } catch (err) {
    console.error('Error batch deleting devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/ping-test - Instant live connection test before saving
/**
 * Smart Multi-Layer Host Probe (ICMP Echo + TCP Syn with RST Recognition + ARP Neighbor)
 */
export async function probeHostLive(target) {
  const rawTarget = String(target || '').trim();
  let host = rawTarget;
  let parsedPort = null;

  if (rawTarget.includes(':') && !rawTarget.startsWith('[')) {
    const parts = rawTarget.split(':');
    host = parts[0];
    parsedPort = parseInt(parts[1], 10);
  }

  const isWindows = process.platform === 'win32';
  const isLan = host.startsWith('192.168.') || host.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  // 1. Fast Layer 2 ARP Check for local LAN hosts
  if (isWindows && isLan && !parsedPort) {
    try {
      const arpOutput = await new Promise((resolve) => {
        execFile('arp', ['-a'], { timeout: 1200 }, (err, stdout) => {
          resolve(stdout || '');
        });
      });

      const lines = arpOutput.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F[:-]+)\s+(dynamic|static)/i);
        if (match && match[1] === host) {
          const rawMac = match[2].toLowerCase();
          if (rawMac !== 'ff-ff-ff-ff-ff-ff' && !rawMac.startsWith('01-00-5e')) {
            return {
              success: true,
              status: 'UP',
              latency: 1.8,
              jitter: 0.4,
              method: 'ARP Neighbor',
              message: `Active on LAN (${rawMac.toUpperCase()})`
            };
          }
        }
      }
    } catch (_) {}
  }

  // 2. ICMP Ping Probe
  try {
    const pingCmd = 'ping';
    const pingArgs = isWindows ? ['-4', '-n', '2', '-w', '800', host] : ['-c', '2', '-W', '1', host];
    const { stdout } = await new Promise((resolve, reject) => {
      execFile(pingCmd, pingArgs, { timeout: 2000 }, (err, stdout) => {
        if (err && !stdout) reject(err);
        else resolve({ stdout: stdout || '' });
      });
    });

    const latencies = [];
    const timeRegex = /time[=<]\s*([0-9.]+)\s*ms/gi;
    let match;
    while ((match = timeRegex.exec(stdout)) !== null) {
      latencies.push(parseFloat(match[1]));
    }

    if (latencies.length > 0) {
      const avgLatency = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1));
      let jitter = 0.4;
      if (latencies.length > 1) {
        jitter = Number(Math.abs(latencies[1] - latencies[0]).toFixed(1));
      }
      return {
        success: true,
        status: avgLatency > 150 ? 'WARNING' : 'UP',
        latency: avgLatency,
        jitter,
        method: 'ICMP Echo',
        message: `Replied in ${avgLatency}ms (Jitter: ${jitter}ms)`
      };
    }
  } catch (_) {}

  // 3. TCP Probe with per-socket timing and ECONNREFUSED (RST) recognition
  const portsToTest = parsedPort ? [parsedPort] : [80, 443, 53, 135, 445, 8080];
  const tcpResult = await new Promise((resolve) => {
    let resolved = false;
    let completed = 0;
    const watchdog = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 2200);

    for (const port of portsToTest) {
      const sock = new net.Socket();
      sock.setTimeout(1200);
      const portStart = Date.now();

      const finish = (isUp, latency, method, msg) => {
        if (!resolved && isUp) {
          resolved = true;
          clearTimeout(watchdog);
          sock.destroy();
          const jitter = Number(Math.max(0.4, (latency * 0.12)).toFixed(1));
          resolve({
            success: true,
            status: latency > 150 ? 'WARNING' : 'UP',
            latency,
            jitter,
            method,
            message: msg
          });
        } else {
          sock.destroy();
          completed++;
          if (completed >= portsToTest.length && !resolved) {
            resolved = true;
            clearTimeout(watchdog);
            resolve(null);
          }
        }
      };

      sock.connect(port, host, () => {
        const latency = Math.max(1, Date.now() - portStart);
        finish(true, latency, `TCP Port ${port}`, `Active response on Port ${port} (${latency}ms)`);
      });

      sock.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          // ECONNREFUSED = target host actively sent TCP RST packet (Host is UP!)
          const latency = Math.max(1, Date.now() - portStart);
          finish(true, latency, `TCP Port ${port}`, `Active response on Port ${port} (${latency}ms)`);
        } else {
          finish(false);
        }
      });

      sock.on('timeout', () => finish(false));
    }
  });

  if (tcpResult) return tcpResult;

  // 4. Secondary fallback ARP check
  if (isWindows) {
    try {
      const arpOutput = await new Promise((resolve) => {
        execFile('arp', ['-a'], { timeout: 1500 }, (err, stdout) => {
          resolve(stdout || '');
        });
      });

      const lines = arpOutput.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F[:-]+)\s+(dynamic|static)/i);
        if (match && match[1] === host) {
          const rawMac = match[2].toLowerCase();
          if (rawMac !== 'ff-ff-ff-ff-ff-ff' && !rawMac.startsWith('01-00-5e')) {
            return {
              success: true,
              status: 'UP',
              latency: 1.8,
              jitter: 0.4,
              method: 'ARP Neighbor',
              message: `Active on LAN (${rawMac.toUpperCase()})`
            };
          }
        }
      }
    } catch (_) {}
  }

  // 4. Destination genuinely unreachable
  return {
    success: false,
    status: 'DOWN',
    latency: null,
    method: 'Probe Timeout',
    message: 'Destination Host Unreachable (Timeout)'
  };
}

// POST /api/devices/ping-test - Instant live connection test
router.post('/ping-test', async (req, res) => {
  const { target, port, method = 'auto' } = req.body;
  if (!target) return res.status(400).json({ error: 'target is required' });

  try {
    const result = await probeHostLive(target);
    const isUp = Boolean(result.success && result.status !== 'DOWN');
    return res.json({
      ...result,
      alive: isUp,
      time: result.latency !== undefined ? result.latency : null
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      alive: false,
      status: 'DOWN',
      latency: null,
      time: null,
      message: err.message || 'Ping probe error'
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

    // Immediately trigger initial probe and broadcast status
    if (newDevice.monitoring !== false) {
      setTimeout(async () => {
        try {
          const probe = await probeHostLive(newDevice.ip);
          const finalStatus = probe.status || 'DOWN';
          const packetLoss = finalStatus === 'UP' ? 0 : finalStatus === 'WARNING' ? 25 : 100;
          const timestamp = new Date().toISOString();

          const { result, newAlert } = await dataStore.saveMonitoringResult({
            deviceId: Number(newDevice.id),
            timestamp,
            status: finalStatus,
            latency: probe.latency,
            packetLoss,
            message: probe.message || (finalStatus === 'UP' ? `OK: ${probe.latency}ms` : 'Host unreachable')
          });

          broadcastDeviceStatus({
            deviceId: Number(newDevice.id),
            name: newDevice.name,
            ip: newDevice.ip,
            status: result.status,
            latency: result.latency,
            packetLoss: result.packetLoss,
            trafficIn: result.trafficIn,
            trafficOut: result.trafficOut,
            speedMbps: result.speedMbps,
            timestamp: result.timestamp,
            message: result.message
          });

          if (newAlert) broadcastNewAlert(newAlert);
        } catch (_) {}
      }, 150);
    }
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

// DELETE /api/devices - Bulk delete devices
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }
    const result = await dataStore.deleteDevices(ids);
    res.json({
      message: `Successfully deleted ${result.deletedCount} devices`,
      deletedCount: result.deletedCount,
      devices: result.removed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const probeResult = await probeHostLive(host);

    const timestamp = new Date().toISOString();
    const status = probeResult.status || 'DOWN';
    const latency = probeResult.latency;
    const jitter = probeResult.jitter || 0;
    const packetLoss = status === 'UP' || status === 'WARNING' ? 0 : 100;
    const message = probeResult.message || (status === 'UP' ? `OK: ${latency}ms` : 'Host unreachable');

    const savedResult = await dataStore.saveMonitoringResult({
      deviceId: Number(id),
      timestamp,
      status,
      latency,
      jitter,
      packetLoss,
      message
    });

    broadcastDeviceStatus({
      deviceId: Number(id),
      status,
      latency,
      jitter,
      packetLoss,
      trafficIn: savedResult.result?.trafficIn,
      trafficOut: savedResult.result?.trafficOut,
      speedMbps: savedResult.result?.speedMbps,
      timestamp,
      message
    });

    res.json({
      success: probeResult.success,
      deviceId: Number(id),
      status,
      latency,
      jitter,
      packetLoss,
      message,
      method: probeResult.method,
      timestamp
    });
  } catch (err) {
    console.error('Error executing ping-now:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
