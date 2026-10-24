import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendThreatAlerts } from './securityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');

const HONEYPOT_CONFIG_FILE = path.join(DATA_DIR, 'honeypot_config.json');
const HONEYPOT_LOGS_FILE = path.join(DATA_DIR, 'honeypot_logs.json');

// Ensure data files exist
function initHoneypotStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HONEYPOT_CONFIG_FILE)) {
    const defaultConfig = {
      enabled: true,
      port: 2222,
      emulatedService: 'ssh', // 'ssh' | 'telnet' | 'http' | 'ftp' | 'silent'
      autoBan: false,
      banner: 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6'
    };
    fs.writeFileSync(HONEYPOT_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  }
  if (!fs.existsSync(HONEYPOT_LOGS_FILE)) {
    fs.writeFileSync(HONEYPOT_LOGS_FILE, JSON.stringify([], null, 2));
  }
}
initHoneypotStorage();

class HoneypotManager {
  constructor() {
    this.server = null;
    this.running = false;
    this.activeConnections = 0;
    this.config = this.loadConfig();
    this.lastHit = null;
    this.startupError = null;

    // Start honeypot listener if configured enabled
    if (this.config.enabled) {
      this.start(this.config.port, this.config.emulatedService);
    }
  }

  loadConfig() {
    try {
      const data = fs.readFileSync(HONEYPOT_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        enabled: true,
        port: 2222,
        emulatedService: 'ssh',
        autoBan: false,
        banner: 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6'
      };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    fs.writeFileSync(HONEYPOT_CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  loadLogs(limit = 100) {
    try {
      const data = fs.readFileSync(HONEYPOT_LOGS_FILE, 'utf8');
      const logs = JSON.parse(data || '[]');
      return logs.slice(0, limit);
    } catch {
      return [];
    }
  }

  appendLog(hit) {
    try {
      let logs = [];
      try {
        logs = JSON.parse(fs.readFileSync(HONEYPOT_LOGS_FILE, 'utf8') || '[]');
      } catch {
        logs = [];
      }
      logs = [hit, ...logs].slice(0, 300); // keep recent 300 hits
      fs.writeFileSync(HONEYPOT_LOGS_FILE, JSON.stringify(logs, null, 2));
      this.lastHit = hit;
    } catch (err) {
      console.error('Error logging honeypot hit:', err);
    }
  }

  clearLogs() {
    try {
      fs.writeFileSync(HONEYPOT_LOGS_FILE, JSON.stringify([], null, 2));
      this.lastHit = null;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  detectProbeType(payload, emulatedService) {
    if (!payload || payload.length === 0) {
      return 'TCP SYN / Stealth Port Scan';
    }
    const clean = payload.toLowerCase();
    if (clean.startsWith('ssh-')) return 'SSH Handshake Reconnaissance';
    if (clean.includes('get ') || clean.includes('post ') || clean.includes('head ') || clean.includes('http/')) {
      return 'Web Vulnerability Scanner Probe';
    }
    if (clean.includes('admin') || clean.includes('root') || clean.includes('user') || clean.includes('pass')) {
      return 'Automated Credential Brute-Force';
    }
    if (clean.includes('mirai') || clean.includes('wget') || clean.includes('curl') || clean.includes('/bin/sh')) {
      return 'Exploit Script / Botnet Injection Probe';
    }
    return `Active ${emulatedService.toUpperCase()} Port Probe`;
  }

  getServiceBanner(service) {
    switch (service) {
      case 'ssh':
        return 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n';
      case 'telnet':
        return '\r\n\r\nUser Access Verification\r\n\r\nUsername: ';
      case 'http':
        return 'HTTP/1.1 200 OK\r\nServer: Apache/2.4.52 (Ubuntu)\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><body><h1>Service Online</h1></body></html>\r\n';
      case 'ftp':
        return '220 (vsFTPd 3.0.5)\r\n';
      case 'silent':
      default:
        return null;
    }
  }

  start(port = 2222, emulatedService = 'ssh') {
    if (this.server) {
      this.stop();
    }

    this.startupError = null;
    const cleanPort = Number(port) || 2222;
    this.config.port = cleanPort;
    this.config.emulatedService = emulatedService;

    try {
      this.server = net.createServer((socket) => {
        this.activeConnections++;
        const rawRemote = socket.remoteAddress || '127.0.0.1';
        // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:192.168.1.50 -> 192.168.1.50)
        const attackerIp = rawRemote.replace(/^.*:/, '');
        const attackerPort = socket.remotePort;
        let receivedData = '';

        // Send decoy banner to induce attacker interaction
        const banner = this.getServiceBanner(this.config.emulatedService);
        if (banner) {
          socket.write(banner);
        }

        socket.on('data', (chunk) => {
          receivedData += chunk.toString('utf8');
          if (receivedData.length > 256) {
            receivedData = receivedData.slice(0, 256);
          }
        });

        const recordHit = () => {
          this.activeConnections = Math.max(0, this.activeConnections - 1);
          const cleanSnippet = receivedData.trim().slice(0, 160) || '[TCP Connection established - Zero payload probe]';
          const probeType = this.detectProbeType(receivedData, this.config.emulatedService);

          const hitRecord = {
            id: `hit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            attackerIp,
            attackerPort,
            targetPort: cleanPort,
            emulatedService: this.config.emulatedService,
            probeType,
            payloadSnippet: cleanSnippet,
            firewallRule: {
              powershell: `New-NetFirewallRule -DisplayName "NetPulse-Ban-${attackerIp}" -Direction Inbound -RemoteAddress ${attackerIp} -Action Block`,
              linuxUfw: `sudo ufw insert 1 deny from ${attackerIp} to any comment 'NetPulse Honeypot Ban'`,
              linuxIptables: `sudo iptables -I INPUT -s ${attackerIp} -j DROP`
            }
          };

          this.appendLog(hitRecord);

          // Push critical threat incident alert
          appendThreatAlerts([{
            id: `threat-honeypot-${Date.now()}`,
            deviceIp: attackerIp,
            deviceName: `Intruder Host (${attackerIp})`,
            port: cleanPort,
            service: `Decoy Honeypot (${this.config.emulatedService.toUpperCase()})`,
            severity: 'CRITICAL',
            title: `🚨 Intruder Probe on Honeypot Port ${cleanPort}`,
            description: `Unauthorized host ${attackerIp}:${attackerPort} probed decoy honeypot. Probe signature: "${probeType}".`,
            recommendation: `Isolate device ${attackerIp} and enforce firewall ban rule immediately.`,
            timestamp: hitRecord.timestamp
          }]);
        };

        socket.once('close', recordHit);
        socket.on('error', () => {
          socket.destroy();
        });

        // Auto disconnect after 8 seconds to free up socket
        setTimeout(() => {
          if (!socket.destroyed) {
            socket.end();
          }
        }, 8000);
      });

      this.server.on('error', (err) => {
        console.error(`Honeypot listener error on port ${cleanPort}:`, err.message);
        this.startupError = err.message;
        this.running = false;
      });

      this.server.listen(cleanPort, '0.0.0.0', () => {
        this.running = true;
        this.startupError = null;
        console.log(`🍯 NetPulse Honeypot Sensor active & listening on 0.0.0.0:${cleanPort} (${emulatedService.toUpperCase()} decoy)`);
      });

      this.saveConfig({ enabled: true, port: cleanPort, emulatedService });
      return { success: true, port: cleanPort, emulatedService };
    } catch (err) {
      this.startupError = err.message;
      this.running = false;
      return { success: false, error: err.message };
    }
  }

  stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch (err) {
        console.warn('Error closing honeypot server:', err);
      }
      this.server = null;
    }
    this.running = false;
    this.saveConfig({ enabled: false });
    console.log('🛑 NetPulse Honeypot Sensor stopped.');
    return { success: true };
  }

  getStatus() {
    const logs = this.loadLogs(300);
    const uniqueAttackers = new Set(logs.map((l) => l.attackerIp));

    return {
      running: this.running,
      port: this.config.port,
      emulatedService: this.config.emulatedService,
      enabled: this.config.enabled,
      activeConnections: this.activeConnections,
      startupError: this.startupError,
      stats: {
        totalHits: logs.length,
        uniqueAttackerIps: uniqueAttackers.size,
        lastHit: this.lastHit || (logs[0] || null)
      },
      recentHits: logs.slice(0, 25)
    };
  }

  // Self-test probe: simulates an attacker probing the honeypot locally
  async simulateProbe() {
    return new Promise((resolve) => {
      if (!this.running) {
        return resolve({ success: false, message: 'Honeypot sensor is currently paused. Please activate it first.' });
      }

      const client = new net.Socket();
      let bannerReceived = '';

      client.connect(this.config.port, '127.0.0.1', () => {
        client.write(`SSH-2.0-NetPulse_Audit_Probe_${Date.now()}\r\n`);
      });

      client.on('data', (data) => {
        bannerReceived += data.toString('utf8');
        setTimeout(() => client.destroy(), 200);
      });

      client.on('close', () => {
        resolve({
          success: true,
          message: `Simulation test probe executed against port ${this.config.port}. Intrusion event logged!`,
          bannerReceived: bannerReceived.trim() || 'None'
        });
      });

      client.on('error', (err) => {
        resolve({
          success: false,
          message: `Simulation failed to connect: ${err.message}`
        });
      });
    });
  }
}

export const honeypotManager = new HoneypotManager();

export default honeypotManager;
