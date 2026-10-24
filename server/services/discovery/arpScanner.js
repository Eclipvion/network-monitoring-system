import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import dns from 'dns';
import { lookupVendor } from './vendorCatalog.js';

const execPromise = util.promisify(exec);
const dnsPromises = dns.promises;

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

    // Try resolving hostnames in parallel (with timeout)
    await Promise.allSettled(
      discovered.map(async (dev) => {
        try {
          const hostnames = await Promise.race([
            dnsPromises.reverse(dev.ip),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
          ]);
          if (hostnames && hostnames.length > 0) {
            dev.hostname = hostnames[0].split('.')[0];
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

export default {
  detectLocalSubnet,
  scanLocalNeighbors
};
