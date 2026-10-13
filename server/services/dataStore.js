import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory async mutex to serialize file operations
class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  runExclusive(callback) {
    const result = this._queue.then(() => callback());
    this._queue = result.catch(() => {});
    return result;
  }
}

/**
 * Validates IPv4, IPv6, FQDN Hostnames, and optional port numbers (e.g. 57.150.61.1:443)
 */
export function isValidTarget(target) {
  if (!target || typeof target !== 'string') return false;
  const trimmed = target.trim();
  
  // Extract optional port
  const hostPortMatch = trimmed.match(/^([^:]+):(\d+)$/);
  let host = trimmed;
  if (hostPortMatch) {
    host = hostPortMatch[1];
    const port = parseInt(hostPortMatch[2], 10);
    if (port < 1 || port > 65535) return false;
  }

  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  const hostnameRegex = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*$/;

  return ipv4Regex.test(host) || ipv6Regex.test(host) || hostnameRegex.test(host);
}

/**
 * Base Abstract Interface for DataStore.
 * Allows seamless swap from JSONDataStore to PostgreSQLDataStore in Phase 2.
 */
export class BaseDataStore {
  async getDevices() { throw new Error('Not implemented'); }
  async getDeviceById(id) { throw new Error('Not implemented'); }
  async addDevice(device) { throw new Error('Not implemented'); }
  async updateDevice(id, data) { throw new Error('Not implemented'); }
  async deleteDevice(id) { throw new Error('Not implemented'); }
  async getDeviceStatus(id) { throw new Error('Not implemented'); }
  async getDeviceHistory(id, range) { throw new Error('Not implemented'); }
  async saveMonitoringResult(result) { throw new Error('Not implemented'); }
  async getAlerts() { throw new Error('Not implemented'); }
  async resolveAlert(id) { throw new Error('Not implemented'); }
  async getSettings() { throw new Error('Not implemented'); }
  async updateSettings(data) { throw new Error('Not implemented'); }
  async getLogs(options) { throw new Error('Not implemented'); }
  async getDashboardSummary() { throw new Error('Not implemented'); }
}

/**
 * JSON File-based implementation of DataStore with mutex concurrency protection.
 */
export class JSONDataStore extends BaseDataStore {
  constructor(dataDir) {
    super();
    this.dataDir = dataDir || path.resolve(__dirname, '../../data');
    this.devicesFile = path.join(this.dataDir, 'devices.json');
    this.resultsFile = path.join(this.dataDir, 'monitoring-results.json');
    this.alertsFile = path.join(this.dataDir, 'alerts.json');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    this.logsFile = path.join(this.dataDir, 'logs.json');
    this.tracerouteCacheFile = path.join(this.dataDir, 'traceroute-cache.json');
    this.dnsResultsFile = path.join(this.dataDir, 'dns-results.json');
    this.domainsFile = path.join(this.dataDir, 'domains.json');
    this.domainHealthResultsFile = path.join(this.dataDir, 'domain-health-results.json');
    this.mutex = new AsyncMutex();
  }

  async _readJson(filePath, defaultValue = []) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this._writeJson(filePath, defaultValue);
        return defaultValue;
      }
      console.error(`Error reading ${filePath}:`, err);
      return defaultValue;
    }
  }

  async _writeJson(filePath, data) {
    const tempFile = `${filePath}.tmp.${Date.now()}`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempFile, filePath);
  }

  async getDevices() {
    return this.mutex.runExclusive(async () => {
      return this._readJson(this.devicesFile, []);
    });
  }

  async getDeviceById(id) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      return devices.find(d => Number(d.id) === Number(id)) || null;
    });
  }

  async addDevice(deviceData) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);

      // Validate IP or Hostname format
      const ip = (deviceData.ip || '').trim();
      if (!isValidTarget(ip)) {
        throw new Error('Invalid IP address or Hostname format (e.g. 192.168.1.1, 57.150.61.1:443, or s8westus.blob.core.windows.net:443)');
      }

      // Reject duplicate IP / Target
      const exists = devices.some(d => d.ip.toLowerCase() === ip.toLowerCase());
      if (exists) {
        throw new Error(`Device with target ${ip} already exists`);
      }

      const nextId = devices.length > 0 ? Math.max(...devices.map(d => Number(d.id) || 0)) + 1 : 1;
      const settings = await this._readJson(this.settingsFile, { defaultInterval: 30 });

      const newDevice = {
        id: nextId,
        name: deviceData.name.trim(),
        ip: ip,
        type: deviceData.type || 'server',
        monitoring: deviceData.monitoring !== undefined ? Boolean(deviceData.monitoring) : true,
        interval: Number(deviceData.interval) || settings.defaultInterval || 30
      };

      devices.push(newDevice);
      await this._writeJson(this.devicesFile, devices);

      await this._appendLogInternal({
        deviceId: newDevice.id,
        device: newDevice.name,
        event: 'DEVICE_CREATED',
        status: 'INFO',
        message: `Device ${newDevice.name} (${newDevice.ip}) added`
      });

      return newDevice;
    });
  }

  async batchAddDevices(deviceList) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const settings = await this._readJson(this.settingsFile, { defaultInterval: 30 });
      let nextId = devices.length > 0 ? Math.max(...devices.map(d => Number(d.id) || 0)) + 1 : 1;
      const added = [];

      for (const item of deviceList) {
        const ip = (item.ip || '').trim();
        if (!isValidTarget(ip)) continue;
        const exists = devices.some(d => d.ip.toLowerCase() === ip.toLowerCase());
        if (exists) continue;

        const newDevice = {
          id: nextId++,
          name: (item.name || `Device ${ip}`).trim(),
          ip: ip,
          type: item.type || 'server',
          group: item.group || 'Local Network',
          monitoring: item.monitoring !== undefined ? Boolean(item.monitoring) : true,
          interval: Number(item.interval) || settings.defaultInterval || 30
        };

        devices.push(newDevice);
        added.push(newDevice);

        await this._appendLogInternal({
          deviceId: newDevice.id,
          device: newDevice.name,
          event: 'DEVICE_CREATED',
          status: 'INFO',
          message: `Auto-detected device ${newDevice.name} (${newDevice.ip}) added to monitoring`
        });
      }

      if (added.length > 0) {
        await this._writeJson(this.devicesFile, devices);
      }
      return added;
    });
  }

  async updateDevice(id, data) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const index = devices.findIndex(d => Number(d.id) === Number(id));
      if (index === -1) {
        throw new Error(`Device with ID ${id} not found`);
      }

      const target = devices[index];

      if (data.ip && data.ip.trim() !== target.ip) {
        const ip = data.ip.trim();
        if (!isValidTarget(ip)) {
          throw new Error('Invalid IP address or Hostname format (e.g. 192.168.1.1, 57.150.61.1:443, or s8westus.blob.core.windows.net:443)');
        }
        const duplicate = devices.some(d => Number(d.id) !== Number(id) && d.ip.toLowerCase() === ip.toLowerCase());
        if (duplicate) {
          throw new Error(`Device with target ${ip} already exists`);
        }
        target.ip = ip;
      }

      if (data.name !== undefined) target.name = data.name.trim();
      if (data.type !== undefined) target.type = data.type;
      if (data.interval !== undefined) target.interval = Math.max(5, Number(data.interval) || 30);
      if (data.monitoring !== undefined) target.monitoring = Boolean(data.monitoring);

      devices[index] = target;
      await this._writeJson(this.devicesFile, devices);

      await this._appendLogInternal({
        deviceId: target.id,
        device: target.name,
        event: 'DEVICE_UPDATED',
        status: 'INFO',
        message: `Device ${target.name} configuration updated`
      });

      return target;
    });
  }

  async deleteDevice(id) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const index = devices.findIndex(d => Number(d.id) === Number(id));
      if (index === -1) {
        throw new Error(`Device with ID ${id} not found`);
      }

      const [removed] = devices.splice(index, 1);
      await this._writeJson(this.devicesFile, devices);

      await this._appendLogInternal({
        deviceId: removed.id,
        device: removed.name,
        event: 'DEVICE_DELETED',
        status: 'INFO',
        message: `Device ${removed.name} (${removed.ip}) deleted`
      });

      return removed;
    });
  }

  async getDeviceStatus(id) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const device = devices.find(d => Number(d.id) === Number(id));
      if (!device) return null;

      const results = await this._readJson(this.resultsFile, []);
      const deviceResults = results.filter(r => Number(r.deviceId) === Number(id));
      const latest = deviceResults.length > 0 ? deviceResults[deviceResults.length - 1] : null;

      const uptimePercent = this._calculateUptime(deviceResults);

      return {
        device,
        status: device.monitoring ? (latest?.status || 'UNKNOWN') : 'PAUSED',
        latency: latest ? latest.latency : null,
        packetLoss: latest ? latest.packetLoss : null,
        lastCheck: latest ? latest.timestamp : null,
        message: latest ? latest.message : null,
        uptime: uptimePercent
      };
    });
  }

  async getDeviceHistory(id, range = '24h') {
    return this.mutex.runExclusive(async () => {
      const results = await this._readJson(this.resultsFile, []);
      const deviceResults = results.filter(r => Number(r.deviceId) === Number(id));

      const now = Date.now();
      let windowMs = 24 * 60 * 60 * 1000;
      if (range === '1h') windowMs = 60 * 60 * 1000;
      if (range === '7d') windowMs = 7 * 24 * 60 * 60 * 1000;

      const filtered = deviceResults.filter(r => {
        const t = new Date(r.timestamp).getTime();
        return now - t <= windowMs;
      });

      return filtered;
    });
  }

  async saveMonitoringResult(result) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const device = devices.find(d => Number(d.id) === Number(result.deviceId));
      if (!device) {
        throw new Error(`Device ID ${result.deviceId} does not exist`);
      }

      const results = await this._readJson(this.resultsFile, []);
      const alerts = await this._readJson(this.alertsFile, []);

      // Find previous result for this device
      const prevResults = results.filter(r => Number(r.deviceId) === Number(result.deviceId));
      const previous = prevResults.length > 0 ? prevResults[prevResults.length - 1] : null;
      const prevStatus = previous ? previous.status : null;

      const newEntry = {
        deviceId: Number(result.deviceId),
        timestamp: result.timestamp || new Date().toISOString(),
        status: result.status, // 'UP', 'DOWN', 'WARNING'
        latency: typeof result.latency === 'number' ? Number(result.latency.toFixed(2)) : null,
        packetLoss: typeof result.packetLoss === 'number' ? Number(result.packetLoss.toFixed(1)) : 0,
        message: result.message || null
      };

      results.push(newEntry);

      // Retention rule: keep only last 500 per device OR last 7 days, whichever is smaller
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const prunedResults = [];
      const byDevice = new Map();

      for (const item of results) {
        const itemTime = new Date(item.timestamp).getTime();
        if (itemTime < sevenDaysAgo) continue; // prune older than 7 days
        const list = byDevice.get(item.deviceId) || [];
        list.push(item);
        byDevice.set(item.deviceId, list);
      }

      for (const [, list] of byDevice.entries()) {
        const sliced = list.slice(-500); // keep max 500
        prunedResults.push(...sliced);
      }

      // Sort chronological
      prunedResults.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      await this._writeJson(this.resultsFile, prunedResults);

      let newAlert = null;
      const resolvedAlerts = [];

      // Alert & Recovery logic:
      // "Do not create a new DOWN alert for a device that already has an unresolved DOWN alert.
      // Mark it resolved when a RECOVERY event is recorded."
      if (newEntry.status === 'DOWN') {
        const hasUnresolvedDown = alerts.some(a => Number(a.deviceId) === Number(device.id) && a.type === 'DOWN' && !a.resolved);
        if (!hasUnresolvedDown) {
          newAlert = {
            id: crypto.randomUUID(),
            deviceId: Number(device.id),
            deviceName: device.name,
            deviceIp: device.ip,
            type: 'DOWN',
            timestamp: newEntry.timestamp,
            resolved: false,
            resolvedAt: null,
            message: newEntry.message || 'Host is unreachable'
          };
          alerts.unshift(newAlert);
          await this._writeJson(this.alertsFile, alerts);

          await this._appendLogInternal({
            deviceId: device.id,
            device: device.name,
            event: 'ALERT_DOWN',
            status: 'DOWN',
            message: `Alert triggered: ${device.name} is DOWN (${newEntry.message || 'No ping response'})`
          });
        }
      } else if (newEntry.status === 'UP' || newEntry.status === 'WARNING') {
        if (prevStatus === 'DOWN') {
          // Recovery event
          for (const alert of alerts) {
            if (Number(alert.deviceId) === Number(device.id) && alert.type === 'DOWN' && !alert.resolved) {
              alert.resolved = true;
              alert.resolvedAt = newEntry.timestamp;
              resolvedAlerts.push(alert);
            }
          }
          if (resolvedAlerts.length > 0) {
            await this._writeJson(this.alertsFile, alerts);
            await this._appendLogInternal({
              deviceId: device.id,
              device: device.name,
              event: 'RECOVERY',
              status: newEntry.status,
              message: `Device ${device.name} recovered to ${newEntry.status} (latency: ${newEntry.latency}ms)`
            });
          }
        }
      }

      return {
        result: newEntry,
        device,
        newAlert,
        resolvedAlerts
      };
    });
  }

  async getAlerts() {
    return this.mutex.runExclusive(async () => {
      const alerts = await this._readJson(this.alertsFile, []);
      const devices = await this._readJson(this.devicesFile, []);
      const deviceMap = new Map(devices.map(d => [Number(d.id), d]));

      return alerts.map(a => ({
        ...a,
        device: deviceMap.get(Number(a.deviceId)) || { id: a.deviceId, name: a.deviceName || 'Unknown', ip: a.deviceIp || '' }
      }));
    });
  }

  async resolveAlert(id) {
    return this.mutex.runExclusive(async () => {
      const alerts = await this._readJson(this.alertsFile, []);
      const alert = alerts.find(a => a.id === id);
      if (!alert) {
        throw new Error(`Alert ${id} not found`);
      }
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      await this._writeJson(this.alertsFile, alerts);

      await this._appendLogInternal({
        deviceId: alert.deviceId,
        device: alert.deviceName || 'Device',
        event: 'ALERT_RESOLVED_MANUAL',
        status: 'INFO',
        message: `Alert ${id} manually resolved`
      });

      return alert;
    });
  }

  async getSettings() {
    return this.mutex.runExclusive(async () => {
      const defaults = {
        defaultInterval: 30,
        latencyWarningThresholdMs: 150,
        packetLossWarningPercent: 20,
        retryCountBeforeDown: 2,
        organizationName: 'NetPulse Enterprise NOC',
        reportSubtitle: 'Infrastructure SLA & Downtime Audit Report',
        slaTargetPercent: 99.9,
        reportLogoUrl: '',
        auditRetentionDays: 90
      };
      const loaded = await this._readJson(this.settingsFile, defaults);
      return { ...defaults, ...loaded };
    });
  }

  async updateSettings(data) {
    return this.mutex.runExclusive(async () => {
      const current = await this._readJson(this.settingsFile, {});

      const updated = {
        ...current,
        defaultInterval: Number(data.defaultInterval) || current.defaultInterval || 30,
        latencyWarningThresholdMs: Number(data.latencyWarningThresholdMs) || current.latencyWarningThresholdMs || 150,
        packetLossWarningPercent: Number(data.packetLossWarningPercent) || current.packetLossWarningPercent || 20,
        retryCountBeforeDown: Number(data.retryCountBeforeDown) || current.retryCountBeforeDown || 2,
        organizationName: typeof data.organizationName === 'string' ? data.organizationName.trim() : (current.organizationName || 'NetPulse Enterprise NOC'),
        reportSubtitle: typeof data.reportSubtitle === 'string' ? data.reportSubtitle.trim() : (current.reportSubtitle || 'Infrastructure SLA & Downtime Audit Report'),
        slaTargetPercent: data.slaTargetPercent !== undefined && !isNaN(Number(data.slaTargetPercent)) ? Number(data.slaTargetPercent) : (current.slaTargetPercent || 99.9),
        reportLogoUrl: typeof data.reportLogoUrl === 'string' ? data.reportLogoUrl.trim() : (current.reportLogoUrl || ''),
        auditRetentionDays: Number(data.auditRetentionDays) || current.auditRetentionDays || 90
      };

      await this._writeJson(this.settingsFile, updated);

      await this._appendLogInternal({
        deviceId: null,
        device: 'System',
        event: 'SETTINGS_UPDATED',
        status: 'INFO',
        severity: 'SECURITY',
        actor: data.actor || 'Admin (Console)',
        ip: data.ip || '127.0.0.1',
        message: `System monitoring and organization branding settings updated`
      });

      return updated;
    });
  }

  async getLogs({ page = 1, limit = 50, deviceId, event, severity, search, from, to } = {}) {
    return this.mutex.runExclusive(async () => {
      const logs = await this._readJson(this.logsFile, []);
      let filtered = logs;

      if (deviceId) {
        filtered = filtered.filter(l => Number(l.deviceId) === Number(deviceId));
      }
      if (event) {
        filtered = filtered.filter(l => l.event && l.event.toLowerCase() === event.toLowerCase());
      }
      if (severity) {
        filtered = filtered.filter(l => (l.severity || l.status || '').toLowerCase() === severity.toLowerCase());
      }
      if (from) {
        const fromTime = new Date(from).getTime();
        filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= fromTime);
      }
      if (to) {
        const toTime = new Date(to).getTime();
        filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= toTime);
      }
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        filtered = filtered.filter(l => 
          (l.message && l.message.toLowerCase().includes(term)) ||
          (l.device && l.device.toLowerCase().includes(term)) ||
          (l.event && l.event.toLowerCase().includes(term)) ||
          (l.actor && l.actor.toLowerCase().includes(term)) ||
          (l.ip && l.ip.toLowerCase().includes(term))
        );
      }

      // Sort newest first
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const total = filtered.length;
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.max(1, Number(limit));
      const startIndex = (pageNum - 1) * limitNum;
      const paginated = filtered.slice(startIndex, startIndex + limitNum);

      return {
        data: paginated,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      };
    });
  }

  async getLogsExport({ deviceId, event, severity, search, from, to, format = 'csv' } = {}) {
    return this.mutex.runExclusive(async () => {
      const logs = await this._readJson(this.logsFile, []);
      let filtered = logs;

      if (deviceId) {
        filtered = filtered.filter(l => Number(l.deviceId) === Number(deviceId));
      }
      if (event) {
        filtered = filtered.filter(l => l.event && l.event.toLowerCase() === event.toLowerCase());
      }
      if (severity) {
        filtered = filtered.filter(l => (l.severity || l.status || '').toLowerCase() === severity.toLowerCase());
      }
      if (from) {
        const fromTime = new Date(from).getTime();
        filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= fromTime);
      }
      if (to) {
        const toTime = new Date(to).getTime();
        filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= toTime);
      }
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        filtered = filtered.filter(l => 
          (l.message && l.message.toLowerCase().includes(term)) ||
          (l.device && l.device.toLowerCase().includes(term)) ||
          (l.event && l.event.toLowerCase().includes(term)) ||
          (l.actor && l.actor.toLowerCase().includes(term)) ||
          (l.ip && l.ip.toLowerCase().includes(term))
        );
      }

      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (format.toLowerCase() === 'json') {
        return JSON.stringify(filtered, null, 2);
      }

      // Format CSV
      const rows = [];
      rows.push(['Timestamp', 'Target Device', 'Event Type', 'Severity', 'Actor / Operator', 'IP Address', 'Status', 'Message'].join(','));
      for (const log of filtered) {
        const esc = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
        rows.push([
          esc(log.timestamp),
          esc(log.device),
          esc(log.event),
          esc(log.severity || log.status || 'INFO'),
          esc(log.actor || 'System'),
          esc(log.ip || '127.0.0.1'),
          esc(log.status || 'INFO'),
          esc(log.message)
        ].join(','));
      }
      return rows.join('\r\n');
    });
  }

  async appendLog(logEntry) {
    return this.mutex.runExclusive(async () => {
      return this._appendLogInternal(logEntry);
    });
  }

  async _appendLogInternal(entry) {
    const logs = await this._readJson(this.logsFile, []);
    
    // Auto infer severity if not provided
    let inferredSeverity = entry.severity;
    if (!inferredSeverity) {
      if (entry.event === 'ALERT_DOWN' || entry.status === 'CRITICAL') {
        inferredSeverity = 'CRITICAL';
      } else if (entry.event === 'RECOVERY' || entry.status === 'SUCCESS') {
        inferredSeverity = 'SUCCESS';
      } else if (entry.status === 'WARNING') {
        inferredSeverity = 'WARNING';
      } else if (entry.event.startsWith('DEVICE_') || entry.event.startsWith('SETTINGS_') || entry.event.includes('MANUAL')) {
        inferredSeverity = 'SECURITY';
      } else {
        inferredSeverity = 'INFO';
      }
    }

    const newLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      deviceId: entry.deviceId || null,
      device: entry.device || 'System',
      event: entry.event || 'GENERAL',
      severity: inferredSeverity,
      actor: entry.actor || (entry.event.startsWith('DEVICE_') || entry.event.startsWith('SETTINGS_') || entry.event.includes('MANUAL') ? 'Admin (Console)' : 'Automated Monitor Engine'),
      ip: entry.ip || '127.0.0.1',
      status: entry.status || 'INFO',
      message: entry.message || ''
    };
    logs.unshift(newLog);
    // Keep max 2500 log entries
    if (logs.length > 2500) {
      logs.length = 2500;
    }
    await this._writeJson(this.logsFile, logs);
    return newLog;
  }

  async getDashboardSummary() {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const results = await this._readJson(this.resultsFile, []);
      const alerts = await this._readJson(this.alertsFile, []);

      // Group results by device to get latest
      const latestMap = new Map();
      for (const res of results) {
        const existing = latestMap.get(res.deviceId);
        if (!existing || new Date(res.timestamp) > new Date(existing.timestamp)) {
          latestMap.set(res.deviceId, res);
        }
      }

      let upCount = 0;
      let downCount = 0;
      let warningCount = 0;
      let pausedCount = 0;
      let latencySum = 0;
      let latencyCount = 0;

      const deviceSummaries = devices.map(d => {
        if (!d.monitoring) {
          pausedCount++;
          return {
            ...d,
            status: 'PAUSED',
            latestResult: latestMap.get(d.id) || null
          };
        }

        const latest = latestMap.get(d.id);
        const status = latest?.status || 'PENDING';

        if (status === 'UP') upCount++;
        else if (status === 'DOWN') downCount++;
        else if (status === 'WARNING') warningCount++;

        if (latest && typeof latest.latency === 'number' && status !== 'DOWN') {
          latencySum += latest.latency;
          latencyCount++;
        }

        return {
          ...d,
          status,
          latestResult: latest || null
        };
      });

      const activeAlerts = alerts.filter(a => !a.resolved);
      const avgLatency = latencyCount > 0 ? Number((latencySum / latencyCount).toFixed(2)) : 0;

      return {
        totalDevices: devices.length,
        upCount,
        downCount,
        warningCount,
        pausedCount,
        avgLatency,
        activeAlertCount: activeAlerts.length,
        devices: deviceSummaries,
        recentAlerts: activeAlerts.slice(0, 5)
      };
    });
  }

  _calculateUptime(deviceResults) {
    if (!deviceResults || deviceResults.length === 0) return 100;
    const upOrWarning = deviceResults.filter(r => r.status === 'UP' || r.status === 'WARNING').length;
    return Number(((upOrWarning / deviceResults.length) * 100).toFixed(1));
  }

  // --- TRACEROUTE & DIAGNOSTICS ---
  async getTracerouteCache(target) {
    return this.mutex.runExclusive(async () => {
      const cache = await this._readJson(this.tracerouteCacheFile, {});
      const normalizedTarget = (target || '').trim().toLowerCase();
      return cache[normalizedTarget] || null;
    });
  }

  async saveTracerouteCache(result) {
    return this.mutex.runExclusive(async () => {
      const cache = await this._readJson(this.tracerouteCacheFile, {});
      const target = (result.target || '').trim().toLowerCase();
      cache[target] = {
        target: result.target,
        timestamp: result.timestamp || new Date().toISOString(),
        hops: result.hops || [],
        completed: Boolean(result.completed)
      };
      await this._writeJson(this.tracerouteCacheFile, cache);
      return cache[target];
    });
  }

  // --- DNS PERFORMANCE ---
  async getDnsResults(limit = 200) {
    return this.mutex.runExclusive(async () => {
      const results = await this._readJson(this.dnsResultsFile, []);
      return results.slice(-limit).reverse();
    });
  }

  async saveDnsResult(result) {
    return this.mutex.runExclusive(async () => {
      const results = await this._readJson(this.dnsResultsFile, []);
      const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        resolver: result.resolver,
        resolverName: result.resolverName || result.resolver,
        domain: result.domain,
        resolutionTimeMs: Number(result.resolutionTimeMs || 0),
        success: Boolean(result.success),
        timestamp: result.timestamp || new Date().toISOString()
      };
      results.push(entry);

      // Retention: keep last 200 results per resolver
      const byResolver = new Map();
      for (const item of results) {
        if (!byResolver.has(item.resolver)) {
          byResolver.set(item.resolver, []);
        }
        byResolver.get(item.resolver).push(item);
      }

      const pruned = [];
      for (const [, list] of byResolver.entries()) {
        pruned.push(...list.slice(-200));
      }

      // Sort by timestamp
      pruned.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      await this._writeJson(this.dnsResultsFile, pruned);
      return entry;
    });
  }

  async getDnsSummary() {
    return this.mutex.runExclusive(async () => {
      const settings = await this._readJson(this.settingsFile, {});
      const results = await this._readJson(this.dnsResultsFile, []);
      const configuredResolvers = settings.dnsResolvers || [
        { name: 'Google', ip: '8.8.8.8' },
        { name: 'Cloudflare', ip: '1.1.1.1' },
        { name: 'Quad9', ip: '9.9.9.9' }
      ];

      const resolverMap = new Map();
      for (const r of configuredResolvers) {
        resolverMap.set(r.ip, {
          ip: r.ip,
          name: r.name,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          avgResolutionTimeMs: 0,
          latestCheck: null,
          history: []
        });
      }

      for (const res of results) {
        if (!resolverMap.has(res.resolver)) {
          resolverMap.set(res.resolver, {
            ip: res.resolver,
            name: res.resolverName || res.resolver,
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            avgResolutionTimeMs: 0,
            latestCheck: null,
            history: []
          });
        }
        const data = resolverMap.get(res.resolver);
        data.totalChecks++;
        if (res.success) {
          data.successfulChecks++;
        } else {
          data.failedChecks++;
        }
        data.history.push(res);
        data.latestCheck = res;
      }

      const resolverSummaries = [];
      let fastestResolver = null;
      let minAvgTime = Infinity;

      for (const item of resolverMap.values()) {
        const successes = item.history.filter(h => h.success && typeof h.resolutionTimeMs === 'number');
        const avg = successes.length > 0
          ? Number((successes.reduce((acc, h) => acc + h.resolutionTimeMs, 0) / successes.length).toFixed(1))
          : null;
        const successRate = item.totalChecks > 0
          ? Number(((item.successfulChecks / item.totalChecks) * 100).toFixed(1))
          : 0;

        const summary = {
          ip: item.ip,
          name: item.name,
          totalChecks: item.totalChecks,
          successfulChecks: item.successfulChecks,
          failedChecks: item.failedChecks,
          successRate,
          avgResolutionTimeMs: avg,
          latestCheck: item.latestCheck,
          recentHistory: item.history.slice(-20)
        };

        resolverSummaries.push(summary);

        if (avg !== null && avg < minAvgTime && successRate > 50) {
          minAvgTime = avg;
          fastestResolver = summary;
        }
      }

      return {
        resolvers: resolverSummaries,
        fastestResolver: fastestResolver || resolverSummaries[0] || null,
        testDomains: settings.dnsTestDomains || ['google.com', 'cloudflare.com'],
        intervalSeconds: settings.dnsCheckIntervalSeconds || 300,
        totalMeasurements: results.length
      };
    });
  }

  // --- DOMAIN HEALTH ---
  async getDomains() {
    return this.mutex.runExclusive(async () => {
      return this._readJson(this.domainsFile, []);
    });
  }

  async getDomainById(id) {
    return this.mutex.runExclusive(async () => {
      const domains = await this._readJson(this.domainsFile, []);
      return domains.find(d => Number(d.id) === Number(id)) || null;
    });
  }

  async addDomain(domainData) {
    return this.mutex.runExclusive(async () => {
      const domains = await this._readJson(this.domainsFile, []);
      let rawDomain = (domainData.domain || '').trim().toLowerCase();
      // Strip protocols and trailing slashes if present
      rawDomain = rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

      if (!rawDomain) {
        throw new Error('Valid domain name is required');
      }

      if (domains.some(d => d.domain.toLowerCase() === rawDomain)) {
        throw new Error(`Domain ${rawDomain} is already configured`);
      }

      const maxId = domains.reduce((max, d) => Math.max(max, Number(d.id) || 0), 0);
      const newDomain = {
        id: maxId + 1,
        domain: rawDomain,
        monitoring: domainData.monitoring !== undefined ? Boolean(domainData.monitoring) : true,
        interval: Number(domainData.interval) || 3600,
        createdAt: new Date().toISOString()
      };

      domains.push(newDomain);
      await this._writeJson(this.domainsFile, domains);

      await this._appendLogInternal({
        deviceId: null,
        device: newDomain.domain,
        event: 'DOMAIN_ADDED',
        status: 'INFO',
        message: `Domain ${newDomain.domain} added for health monitoring`
      });

      return newDomain;
    });
  }

  async updateDomain(id, updateData) {
    return this.mutex.runExclusive(async () => {
      const domains = await this._readJson(this.domainsFile, []);
      const index = domains.findIndex(d => Number(d.id) === Number(id));
      if (index === -1) {
        throw new Error(`Domain #${id} not found`);
      }

      const domain = domains[index];
      if (updateData.domain) {
        let rawDomain = updateData.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (rawDomain && rawDomain !== domain.domain) {
          if (domains.some(d => d.id !== domain.id && d.domain.toLowerCase() === rawDomain)) {
            throw new Error(`Domain ${rawDomain} is already registered`);
          }
          domain.domain = rawDomain;
        }
      }
      if (updateData.interval !== undefined) {
        domain.interval = Number(updateData.interval) || 3600;
      }
      if (updateData.monitoring !== undefined) {
        domain.monitoring = Boolean(updateData.monitoring);
      }

      domains[index] = domain;
      await this._writeJson(this.domainsFile, domains);
      return domain;
    });
  }

  async deleteDomain(id) {
    return this.mutex.runExclusive(async () => {
      const domains = await this._readJson(this.domainsFile, []);
      const filtered = domains.filter(d => Number(d.id) !== Number(id));
      if (filtered.length === domains.length) {
        throw new Error(`Domain #${id} not found`);
      }
      await this._writeJson(this.domainsFile, filtered);

      // Clean health results
      const results = await this._readJson(this.domainHealthResultsFile, []);
      const cleanResults = results.filter(r => Number(r.domainId) !== Number(id));
      await this._writeJson(this.domainHealthResultsFile, cleanResults);

      return { success: true };
    });
  }

  async saveDomainHealthResult(result) {
    return this.mutex.runExclusive(async () => {
      const results = await this._readJson(this.domainHealthResultsFile, []);
      const entry = {
        domainId: Number(result.domainId),
        timestamp: result.timestamp || new Date().toISOString(),
        httpStatus: result.httpStatus !== undefined ? Number(result.httpStatus) : null,
        responseTimeMs: result.responseTimeMs !== undefined ? Number(result.responseTimeMs) : null,
        sslValid: result.sslValid !== undefined ? Boolean(result.sslValid) : null,
        sslExpiresAt: result.sslExpiresAt || null,
        sslDaysRemaining: result.sslDaysRemaining !== undefined ? Number(result.sslDaysRemaining) : null,
        dnsResolved: Boolean(result.dnsResolved),
        resolvedIp: result.resolvedIp || null
      };

      results.push(entry);

      // Retention: last 100 results per domain
      const byDomain = new Map();
      for (const item of results) {
        if (!byDomain.has(item.domainId)) {
          byDomain.set(item.domainId, []);
        }
        byDomain.get(item.domainId).push(item);
      }

      const pruned = [];
      for (const [, list] of byDomain.entries()) {
        pruned.push(...list.slice(-100));
      }
      pruned.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      await this._writeJson(this.domainHealthResultsFile, pruned);
      return entry;
    });
  }

  async getDomainHealthHistory(domainId, limit = 100) {
    return this.mutex.runExclusive(async () => {
      const results = await this._readJson(this.domainHealthResultsFile, []);
      const filtered = results.filter(r => Number(r.domainId) === Number(domainId));
      return filtered.slice(-limit);
    });
  }

  async getDomainsWithHealth() {
    return this.mutex.runExclusive(async () => {
      const domains = await this._readJson(this.domainsFile, []);
      const results = await this._readJson(this.domainHealthResultsFile, []);
      const settings = await this._readJson(this.settingsFile, {});
      const sslThreshold = settings.sslWarningDaysThreshold || 14;

      // Group latest result per domain
      const latestMap = new Map();
      for (const r of results) {
        const existing = latestMap.get(r.domainId);
        if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
          latestMap.set(r.domainId, r);
        }
      }

      return domains.map(d => {
        const latest = latestMap.get(Number(d.id)) || null;
        let healthStatus = 'PENDING';

        if (!d.monitoring) {
          healthStatus = 'PAUSED';
        } else if (latest) {
          if (!latest.dnsResolved || (latest.httpStatus && latest.httpStatus >= 500)) {
            healthStatus = 'DOWN';
          } else if (
            (latest.sslDaysRemaining !== null && latest.sslDaysRemaining < sslThreshold) ||
            (latest.httpStatus && latest.httpStatus >= 400)
          ) {
            healthStatus = 'WARNING';
          } else {
            healthStatus = 'UP';
          }
        }

        return {
          ...d,
          healthStatus,
          latestResult: latest
        };
      });
    });
  }

  // --- REPORT EXPORT & ANALYTICS ---
  async getMonitoringExportData({ type, status, from, to } = {}) {
    return this.mutex.runExclusive(async () => {
      const summary = await this.getDashboardSummary();
      let list = summary.devices || [];

      if (type && type !== 'ALL') {
        list = list.filter(d => (d.type || '').toLowerCase() === type.toLowerCase());
      }

      if (status && status !== 'ALL') {
        list = list.filter(d => (d.status || '').toUpperCase() === status.toUpperCase());
      }

      return list.map(d => ({
        name: d.name,
        ip: d.ip,
        type: d.type || 'other',
        status: d.status || 'UNKNOWN',
        latency: d.latestResult?.latency !== null && d.latestResult?.latency !== undefined ? d.latestResult.latency : 'N/A',
        packetLoss: d.latestResult?.packetLoss !== undefined ? d.latestResult.packetLoss : 0,
        lastChecked: d.latestResult?.timestamp || 'Never'
      }));
    });
  }

  /**
   * Comprehensive Report Analytics for Uptime, Downtime, Incidents, and Telemetry Trends
   */
  async getReportAnalytics({ deviceId, days, from, to, type, status } = {}) {
    return this.mutex.runExclusive(async () => {
      const devices = await this._readJson(this.devicesFile, []);
      const results = await this._readJson(this.resultsFile, []);
      const alerts = await this._readJson(this.alertsFile, []);
      const settings = await this._readJson(this.settingsFile, {
        organizationName: 'NetPulse Enterprise NOC',
        reportSubtitle: 'Infrastructure SLA & Downtime Audit Report',
        slaTargetPercent: 99.9,
        reportLogoUrl: ''
      });

      // Calculate time window
      const now = Date.now();
      const isCustomRange = Boolean(from || to);
      let fromTime;
      let toTime;

      if (isCustomRange) {
        if (from) {
          fromTime = new Date(from).getTime();
        } else {
          fromTime = (to ? new Date(to).getTime() : now) - 7 * 24 * 60 * 60 * 1000;
        }

        if (to) {
          if (typeof to === 'string' && to.length === 10) {
            toTime = new Date(`${to}T23:59:59.999`).getTime();
          } else {
            toTime = new Date(to).getTime();
          }
        } else {
          toTime = now;
        }
      } else if (days !== undefined && days !== null && days !== '' && !isNaN(Number(days))) {
        const numDays = Math.max(0.01, Number(days));
        toTime = now;
        fromTime = now - numDays * 24 * 60 * 60 * 1000;
      } else {
        toTime = now;
        fromTime = now - 7 * 24 * 60 * 60 * 1000;
      }

      if (isNaN(fromTime)) fromTime = now - 7 * 24 * 60 * 60 * 1000;
      if (isNaN(toTime)) toTime = now;
      if (toTime < fromTime) {
        const tmp = toTime;
        toTime = fromTime;
        fromTime = tmp;
      }

      const diffDays = Number(((toTime - fromTime) / (24 * 60 * 60 * 1000)).toFixed(1));

      // Filter target devices
      let targetDevices = [...devices];
      const isSpecificDevice = deviceId && deviceId !== 'all';
      if (isSpecificDevice) {
        targetDevices = targetDevices.filter(d => Number(d.id) === Number(deviceId));
      }
      if (type && type !== 'ALL') {
        targetDevices = targetDevices.filter(d => (d.type || '').toLowerCase() === type.toLowerCase());
      }

      const targetDeviceIds = new Set(targetDevices.map(d => Number(d.id)));

      // Filter results in date range & target devices
      const filteredResults = results.filter(r => {
        if (!targetDeviceIds.has(Number(r.deviceId))) return false;
        const t = new Date(r.timestamp).getTime();
        return t >= fromTime && t <= toTime;
      });

      // Sort chronological
      filteredResults.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Device map for quick info lookup
      const deviceMap = new Map(devices.map(d => [Number(d.id), d]));

      // 1. Overall counts
      const totalChecks = filteredResults.length;
      let upChecks = 0;
      let downChecks = 0;
      let warningChecks = 0;
      let totalLatency = 0;
      let validLatencyCount = 0;
      let minLatency = Infinity;
      let maxLatency = 0;
      let totalPacketLoss = 0;
      let maxPacketLoss = 0;

      for (const r of filteredResults) {
        if (r.status === 'UP') upChecks++;
        else if (r.status === 'DOWN') downChecks++;
        else if (r.status === 'WARNING') warningChecks++;

        if (r.latency !== null && r.latency !== undefined && typeof r.latency === 'number' && r.latency >= 0) {
          totalLatency += r.latency;
          validLatencyCount++;
          if (r.latency < minLatency) minLatency = r.latency;
          if (r.latency > maxLatency) maxLatency = r.latency;
        }

        if (typeof r.packetLoss === 'number') {
          totalPacketLoss += r.packetLoss;
          if (r.packetLoss > maxPacketLoss) maxPacketLoss = r.packetLoss;
        }
      }

      const uptimePercent = totalChecks > 0 ? Number(((upChecks + warningChecks) / totalChecks * 100).toFixed(2)) : 100;
      const pureUptimePercent = totalChecks > 0 ? Number((upChecks / totalChecks * 100).toFixed(2)) : 100;
      const downtimePercent = totalChecks > 0 ? Number((downChecks / totalChecks * 100).toFixed(2)) : 0;
      const warningPercent = totalChecks > 0 ? Number((warningChecks / totalChecks * 100).toFixed(2)) : 0;
      const avgLatency = validLatencyCount > 0 ? Number((totalLatency / validLatencyCount).toFixed(1)) : null;
      const avgPacketLoss = totalChecks > 0 ? Number((totalPacketLoss / totalChecks).toFixed(1)) : 0;
      if (minLatency === Infinity) minLatency = null;

      // Helper function to format duration in readable format
      const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return '0s';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        return parts.slice(0, 3).join(' ');
      };

      // 2. Incident & Outage history (When did it go DOWN, when did it recover, why/reason, duration)
      // Extract from alerts table first
      const relevantAlerts = alerts.filter(a => {
        if (!targetDeviceIds.has(Number(a.deviceId))) return false;
        const downTime = new Date(a.timestamp).getTime();
        const resolvedTime = a.resolvedAt ? new Date(a.resolvedAt).getTime() : now;
        return downTime <= toTime && resolvedTime >= fromTime;
      });

      const incidents = relevantAlerts.map(a => {
        const downDate = new Date(a.timestamp);
        const resolvedDate = a.resolvedAt ? new Date(a.resolvedAt) : null;
        const durationMs = (resolvedDate ? resolvedDate.getTime() : Math.min(now, toTime)) - downDate.getTime();
        const durationSec = Math.max(0, Math.round(durationMs / 1000));

        const dev = deviceMap.get(Number(a.deviceId));
        return {
          id: a.id,
          deviceId: Number(a.deviceId),
          deviceName: a.deviceName || dev?.name || `Device #${a.deviceId}`,
          deviceIp: a.deviceIp || dev?.ip || 'N/A',
          downAt: a.timestamp,
          upAt: a.resolved ? a.resolvedAt : null,
          isResolved: Boolean(a.resolved),
          durationSeconds: durationSec,
          durationFormatted: formatDuration(durationSec),
          reason: a.message || 'Host is unreachable / Ping probes failed',
          type: a.type || 'DOWN'
        };
      });

      // Also discover any transitions in filteredResults not already in incidents
      const resultsByDevice = new Map();
      for (const r of filteredResults) {
        const list = resultsByDevice.get(r.deviceId) || [];
        list.push(r);
        resultsByDevice.set(r.deviceId, list);
      }

      for (const [devId, dResults] of resultsByDevice.entries()) {
        let currentOutage = null;
        for (let i = 0; i < dResults.length; i++) {
          const r = dResults[i];
          if (r.status === 'DOWN') {
            if (!currentOutage) {
              currentOutage = {
                downAt: r.timestamp,
                reason: r.message || 'Destination Host Unreachable',
                deviceId: devId
              };
            }
          } else {
            if (currentOutage) {
              const downT = new Date(currentOutage.downAt).getTime();
              const upT = new Date(r.timestamp).getTime();
              const durSec = Math.max(0, Math.round((upT - downT) / 1000));
              const alreadyCovered = incidents.some(inc => 
                inc.deviceId === devId && Math.abs(new Date(inc.downAt).getTime() - downT) < 60000
              );
              if (!alreadyCovered && durSec > 0) {
                const dev = deviceMap.get(devId);
                incidents.push({
                  id: `tr-${devId}-${downT}`,
                  deviceId: devId,
                  deviceName: dev?.name || `Device #${devId}`,
                  deviceIp: dev?.ip || 'N/A',
                  downAt: currentOutage.downAt,
                  upAt: r.timestamp,
                  isResolved: true,
                  durationSeconds: durSec,
                  durationFormatted: formatDuration(durSec),
                  reason: currentOutage.reason,
                  type: 'DOWN'
                });
              }
              currentOutage = null;
            }
          }
        }
        if (currentOutage) {
          const downT = new Date(currentOutage.downAt).getTime();
          const durSec = Math.max(0, Math.round((toTime - downT) / 1000));
          const alreadyCovered = incidents.some(inc => 
            inc.deviceId === devId && Math.abs(new Date(inc.downAt).getTime() - downT) < 60000
          );
          if (!alreadyCovered) {
            const dev = deviceMap.get(devId);
            incidents.push({
              id: `tr-${devId}-${downT}`,
              deviceId: devId,
              deviceName: dev?.name || `Device #${devId}`,
              deviceIp: dev?.ip || 'N/A',
              downAt: currentOutage.downAt,
              upAt: null,
              isResolved: false,
              durationSeconds: durSec,
              durationFormatted: `Ongoing (${formatDuration(durSec)})`,
              reason: currentOutage.reason,
              type: 'DOWN'
            });
          }
        }
      }

      // Sort incidents descending (newest first)
      incidents.sort((a, b) => new Date(b.downAt) - new Date(a.downAt));

      const totalDowntimeSeconds = incidents.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
      const totalIncidents = incidents.length;
      const mttrSeconds = totalIncidents > 0 ? Math.round(totalDowntimeSeconds / totalIncidents) : 0;

      // 3. Time Series aggregation for charts (up to 30 data points)
      const numBuckets = 30;
      const bucketSizeMs = Math.max(60000, Math.floor((toTime - fromTime) / numBuckets));
      const timeSeries = [];

      const formatTimeTick = (date, windowMs) => {
        if (windowMs <= 24 * 3600 * 1000) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      };

      for (let b = 0; b < numBuckets; b++) {
        const bStart = fromTime + b * bucketSizeMs;
        const bEnd = bStart + bucketSizeMs;
        const inBucket = filteredResults.filter(r => {
          const t = new Date(r.timestamp).getTime();
          return t >= bStart && t < bEnd;
        });

        if (inBucket.length > 0) {
          let bLatSum = 0;
          let bLatCount = 0;
          let bLossSum = 0;
          let bDown = 0;
          let bWarn = 0;
          let bUp = 0;

          for (const item of inBucket) {
            if (item.status === 'UP') bUp++;
            else if (item.status === 'DOWN') bDown++;
            else if (item.status === 'WARNING') bWarn++;

            if (typeof item.latency === 'number' && item.latency >= 0) {
              bLatSum += item.latency;
              bLatCount++;
            }
            if (typeof item.packetLoss === 'number') {
              bLossSum += item.packetLoss;
            }
          }

          const avgLat = bLatCount > 0 ? Number((bLatSum / bLatCount).toFixed(1)) : 0;
          const avgLoss = Number((bLossSum / inBucket.length).toFixed(1));
          let bucketStatus = 'UP';
          if (bDown > 0) bucketStatus = 'DOWN';
          else if (bWarn > 0) bucketStatus = 'WARNING';

          timeSeries.push({
            timestamp: new Date(bStart).toISOString(),
            timeLabel: formatTimeTick(new Date(bStart), (toTime - fromTime)),
            latency: avgLat,
            packetLoss: avgLoss,
            status: bucketStatus,
            upCount: bUp,
            downCount: bDown,
            warningCount: bWarn,
            totalChecks: inBucket.length
          });
        } else {
          timeSeries.push({
            timestamp: new Date(bStart).toISOString(),
            timeLabel: formatTimeTick(new Date(bStart), (toTime - fromTime)),
            latency: null,
            packetLoss: 0,
            status: 'NO_DATA',
            upCount: 0,
            downCount: 0,
            warningCount: 0,
            totalChecks: 0
          });
        }
      }

      // 4. Device Summaries
      const deviceSummaries = targetDevices.map(d => {
        const devResults = filteredResults.filter(r => Number(r.deviceId) === Number(d.id));
        const devChecks = devResults.length;
        const devUp = devResults.filter(r => r.status === 'UP').length;
        const devWarn = devResults.filter(r => r.status === 'WARNING').length;
        const devDown = devResults.filter(r => r.status === 'DOWN').length;
        const devUptime = devChecks > 0 ? Number(((devUp + devWarn) / devChecks * 100).toFixed(1)) : 100;
        
        const devLatencies = devResults.filter(r => typeof r.latency === 'number' && r.latency >= 0).map(r => r.latency);
        const devAvgLat = devLatencies.length > 0 ? Number((devLatencies.reduce((a, b) => a + b, 0) / devLatencies.length).toFixed(1)) : 'N/A';

        const devIncidents = incidents.filter(i => i.deviceId === Number(d.id));
        const devDowntimeSec = devIncidents.reduce((a, b) => a + (b.durationSeconds || 0), 0);
        const isFlapping = devIncidents.length >= 3;

        return {
          id: d.id,
          name: d.name,
          ip: d.ip,
          type: d.type || 'server',
          interval: d.interval,
          monitoring: d.monitoring,
          totalChecks: devChecks,
          upChecks: devUp,
          warningChecks: devWarn,
          downChecks: devDown,
          uptimePercent: devUptime,
          avgLatency: devAvgLat,
          incidentsCount: devIncidents.length,
          totalDowntimeSeconds: devDowntimeSec,
          totalDowntimeFormatted: formatDuration(devDowntimeSec),
          isFlapping,
          currentStatus: devResults.length > 0 ? devResults[devResults.length - 1].status : (d.monitoring ? 'UNKNOWN' : 'PAUSED')
        };
      });

      // Flapping & Health Score calculations
      const flappingDevices = deviceSummaries.filter(d => d.isFlapping);
      const targetSlaPercent = Number(settings.slaTargetPercent) || 99.9;
      const slaMet = uptimePercent >= targetSlaPercent;
      const slaGap = Number((uptimePercent - targetSlaPercent).toFixed(2));

      // Enterprise Fleet Health Score (0 - 100)
      let healthScore = 100;
      healthScore -= (100 - uptimePercent) * 3.0; // Penalty for downtime
      healthScore -= (avgPacketLoss || 0) * 1.5;   // Penalty for packet loss
      if (typeof avgLatency === 'number' && avgLatency > 120) {
        healthScore -= Math.min(15, (avgLatency - 120) / 10);
      }
      const activeOutages = incidents.filter(i => !i.isResolved).length;
      healthScore -= activeOutages * 10;
      healthScore -= flappingDevices.length * 5;
      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

      let healthGrade = 'A+';
      if (healthScore >= 98) healthGrade = 'A+';
      else if (healthScore >= 90) healthGrade = 'A';
      else if (healthScore >= 80) healthGrade = 'B';
      else if (healthScore >= 70) healthGrade = 'C';
      else healthGrade = 'F';

      return {
        filter: {
          deviceId: isSpecificDevice ? Number(deviceId) : 'all',
          deviceName: isSpecificDevice ? (targetDevices[0]?.name || `Device #${deviceId}`) : 'All Network Devices',
          deviceIp: isSpecificDevice ? targetDevices[0]?.ip : null,
          from: new Date(fromTime).toISOString(),
          to: new Date(toTime).toISOString(),
          days: diffDays,
          isCustomRange,
          type: type || 'ALL'
        },
        branding: {
          organizationName: settings.organizationName || 'NetPulse Enterprise NOC',
          reportSubtitle: settings.reportSubtitle || 'Infrastructure SLA & Downtime Audit Report',
          reportLogoUrl: settings.reportLogoUrl || '',
          slaTargetPercent: targetSlaPercent
        },
        compliance: {
          targetSlaPercent,
          actualUptimePercent: uptimePercent,
          slaStatus: slaMet ? 'SLA_MET' : 'SLA_BREACHED',
          slaGap,
          healthScore,
          healthGrade
        },
        flappingDevices,
        metrics: {
          totalChecks,
          upChecks,
          warningChecks,
          downChecks,
          uptimePercent,
          pureUptimePercent,
          downtimePercent,
          warningPercent,
          avgLatency,
          minLatency,
          maxLatency,
          avgPacketLoss,
          maxPacketLoss,
          totalIncidents,
          totalDowntimeSeconds,
          totalDowntimeFormatted: formatDuration(totalDowntimeSeconds),
          mttrSeconds,
          mttrFormatted: formatDuration(mttrSeconds),
          healthScore,
          healthGrade,
          slaStatus: slaMet ? 'SLA_MET' : 'SLA_BREACHED'
        },
        incidents,
        timeSeries,
        deviceSummaries
      };
    });
  }
}

// Export singleton instance based on environment or default JSONDataStore
const defaultDataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
export const dataStore = new JSONDataStore(defaultDataDir);
export default dataStore;

