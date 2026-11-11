import { exec, execFile } from 'child_process';
import util from 'util';
import os from 'os';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookupVendor } from './vendorCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);
const dnsPromises = dns.promises;

// In-Memory global hostname cache across scans
const globalHostnameCache = new Map();

function findScannerScript() {
  const candidates = [
    path.resolve(__dirname, '../../../python-monitor/scanner.py'),
    path.resolve(__dirname, '../../python-monitor/scanner.py'),
    path.resolve(__dirname, '../python-monitor/scanner.py'),
    path.resolve(process.cwd(), 'python-monitor/scanner.py')
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function findPythonExecutable() {
  const venvPython = path.resolve(__dirname, '../../../.venv/Scripts/python.exe');
  const pythonExecutable =
    process.env.PYTHON_PATH ||
    'C:\\Users\\Ability\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  if (fs.existsSync(pythonExecutable)) {
    return pythonExecutable;
  }
  return 'python';
}

export function detectLocalSubnet() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

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
            subnetBase: base,
            startIp: `${base}.1`,
            endIp: `${base}.254`
          });
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  return {
    name: 'Default',
    localIp: '192.168.46.235',
    subnet: '192.168.46.0/24',
    subnetBase: '192.168.46',
    startIp: '192.168.46.1',
    endIp: '192.168.46.254'
  };
}

/**
 * Harvest active network neighbors from OS ARP table
 */
export async function scanLocalNeighbors() {
  const netInfo = detectLocalSubnet();
  const base = netInfo.subnetBase;
  const discovered = [];

  try {
    const { stdout } = await execPromise('arp -a', { timeout: 3000 });
    const lines = stdout.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match line format: 192.168.46.1   dc-2c-6e-c1-85-fc   dynamic
      const match = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F[:-]+)\s+(dynamic|static)/i);
      if (match) {
        const ip = match[1];
        const rawMac = match[2].toLowerCase().replace(/[:-]/g, ':');
        const type = match[3].toLowerCase();

        // Filter: Must be in local subnet and not broadcast/multicast (e.g. 255 or 224+)
        if (ip.startsWith(base) && !ip.endsWith('.255') && rawMac !== 'ff:ff:ff:ff:ff:ff') {
          // Exclude broadcast or multicast MACs
          if (!rawMac.startsWith('01:00:5e')) {
            const { vendor, type: devType } = lookupVendor(rawMac);
            discovered.push({
              ip,
              mac: rawMac,
              vendor,
              type: devType,
              hostname: '',
              status: 'UP',
              isLocal: true,
              discoveredAt: new Date().toISOString()
            });
          }
        }
      }
    }

    // Known hostnames cache from existing records (prevents losing rich names on sweep)
    const knownHostnames = new Map(globalHostnameCache);

    try {
      const devicesPath = path.resolve(__dirname, '../../../data/devices.json');
      if (fs.existsSync(devicesPath)) {
        const devs = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));
        if (Array.isArray(devs)) {
          for (const d of devs) {
            if (
              d.ip &&
              d.name &&
              !d.name.startsWith('LAN Device') &&
              !d.name.startsWith('Device (') &&
              !d.name.startsWith('VMware Virtual (') &&
              !d.name.includes('(')
            ) {
              knownHostnames.set(d.ip.toLowerCase(), d.name);
            }
          }
        }
      }
    } catch (_) {}

    try {
      const dnsTrafficPath = path.resolve(__dirname, '../../../data/dns_traffic.json');
      if (fs.existsSync(dnsTrafficPath)) {
        const trafficData = JSON.parse(fs.readFileSync(dnsTrafficPath, 'utf8'));
        if (Array.isArray(trafficData)) {
          for (const rec of trafficData) {
            if (rec.clientIp && rec.hostname && !rec.hostname.includes('(') && rec.hostname.length > 2) {
              knownHostnames.set(rec.clientIp.toLowerCase(), rec.hostname);
            }
          }
        }
      }
    } catch (_) {}

    const myHostname = os.hostname();
    const lookupServiceAsync = util.promisify(dns.lookupService);

    // Ensure the host PC itself is always discovered with its real Windows hostname (e.g. DESKTOP-8D1GBAG)
    if (netInfo.localIp && !discovered.some((d) => d.ip === netInfo.localIp)) {
      discovered.unshift({
        ip: netInfo.localIp,
        mac: '',
        vendor: 'Host System',
        type: 'workstation',
        hostname: myHostname,
        status: 'UP',
        isLocal: true,
        discoveredAt: new Date().toISOString()
      });
    }

    // Try resolving hostnames in parallel (with timeout and OS LLMNR/NetBIOS hook)
    await Promise.allSettled(
      discovered.map(async (dev) => {
        // 1. If this IP is our own host PC, use the machine's actual Windows Computer Name
        if (dev.ip === netInfo.localIp || dev.ip === '127.0.0.1') {
          dev.hostname = myHostname;
          globalHostnameCache.set(dev.ip.toLowerCase(), myHostname);
          return;
        }

        // 2. Check cached/known hostname from user activity or previous scan
        const cached = knownHostnames.get(dev.ip.toLowerCase());
        if (cached) {
          dev.hostname = cached;
          return;
        }

        // 3. Try OS resolver (getnameinfo hooks into NetBIOS, LLMNR, mDNS, and DNS)
        try {
          const res = await Promise.race([
            lookupServiceAsync(dev.ip, 80),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
          ]);
          if (res && res.hostname && !res.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            dev.hostname = res.hostname.split('.')[0];
            globalHostnameCache.set(dev.ip.toLowerCase(), dev.hostname);
            return;
          }
        } catch (_) {}

        // 4. Fallback to standard DNS reverse PTR lookup
        try {
          const hostnames = await Promise.race([
            dnsPromises.reverse(dev.ip),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
          ]);
          if (hostnames && hostnames.length > 0) {
            dev.hostname = hostnames[0].split('.')[0];
            globalHostnameCache.set(dev.ip.toLowerCase(), dev.hostname);
          }
        } catch (e) {
          // ignore hostname failure
        }
      })
    );

  } catch (err) {
    console.error('[ArpScanner] Scan error:', err.message);
  }

  return {
    subnet: netInfo.subnet,
    localIp: netInfo.localIp,
    devices: discovered
  };
}

/**
 * Run FULL multi-threaded active subnet sweep via Python scanner
 * Probes all IPs, runs SendARP and multi-threaded reverse DNS, discovering all real Windows PC names
 */
export async function runFullSubnetScan(startIp, endIp, subnet) {
  const netInfo = detectLocalSubnet();
  const sIp = startIp || netInfo.startIp;
  const eIp = endIp || netInfo.endIp;

  const pythonExec = findPythonExecutable();
  const scannerPath = findScannerScript();

  if (fs.existsSync(scannerPath)) {
    try {
      console.log(`[ArpScanner] 🚀 Executing active subnet discovery: ${pythonExec} "${scannerPath}" --start ${sIp} --end ${eIp}`);
      const args = [scannerPath, '--start', sIp, '--end', eIp, '--workers', '75'];
      const { stdout } = await execFilePromise(pythonExec, args, {
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10
      });

      if (stdout) {
        const parsed = JSON.parse(stdout.trim());
        if (parsed && Array.isArray(parsed.devices)) {
          // Always ensure the local host PC is in the list
          const myHostname = os.hostname();
          if (netInfo.localIp && !parsed.devices.some((d) => d.ip === netInfo.localIp)) {
            parsed.devices.unshift({
              ip: netInfo.localIp,
              name: myHostname,
              hostname: myHostname,
              mac: '',
              vendor: 'Host System',
              latency: 1,
              type: 'workstation',
              openPorts: [],
              method: 'Host Loopback',
              status: 'UP'
            });
            parsed.aliveCount = (parsed.aliveCount || parsed.devices.length);
          }

          // Cache all discovered real hostnames into global memory
          parsed.devices.forEach((d) => {
            const h = d.hostname || (d.name && !d.name.includes('(') ? d.name : null);
            if (d.ip && h) {
              globalHostnameCache.set(d.ip.toLowerCase(), h);
            }
          });

          return {
            subnet: parsed.subnet || netInfo.subnet,
            localIp: netInfo.localIp,
            totalScanned: parsed.totalScanned || 254,
            aliveCount: parsed.aliveCount || parsed.devices.length,
            devices: parsed.devices
          };
        }
      }
    } catch (err) {
      console.warn('[ArpScanner] Python full subnet scan failed, falling back to ARP cache:', err.message);
    }
  }

  // Graceful fallback to passive neighbor ARP sweep if Python is absent or fails
  return await scanLocalNeighbors();
}

export default {
  detectLocalSubnet,
  scanLocalNeighbors,
  runFullSubnetScan
};
