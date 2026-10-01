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

      // Validate IP format
      const ip = (deviceData.ip || '').trim();
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (!ipRegex.test(ip)) {
        throw new Error('Invalid IP address format');
      }

      // Reject duplicate IP
      const exists = devices.some(d => d.ip.toLowerCase() === ip.toLowerCase());
      if (exists) {
        throw new Error(`Device with IP ${ip} already exists`);
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
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        if (!ipRegex.test(ip)) {
          throw new Error('Invalid IP address format');
        }
        const duplicate = devices.some(d => Number(d.id) !== Number(id) && d.ip.toLowerCase() === ip.toLowerCase());
        if (duplicate) {
          throw new Error(`Device with IP ${ip} already exists`);
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
      return this._readJson(this.settingsFile, {
        defaultInterval: 30,
        latencyWarningThresholdMs: 150,
        packetLossWarningPercent: 20,
        retryCountBeforeDown: 2
      });
    });
  }

  async updateSettings(data) {
    return this.mutex.runExclusive(async () => {
      const current = await this._readJson(this.settingsFile, {
        defaultInterval: 30,
        latencyWarningThresholdMs: 150,
        packetLossWarningPercent: 20,
        retryCountBeforeDown: 2
      });

      const updated = {
        defaultInterval: Number(data.defaultInterval) || current.defaultInterval || 30,
        latencyWarningThresholdMs: Number(data.latencyWarningThresholdMs) || current.latencyWarningThresholdMs || 150,
        packetLossWarningPercent: Number(data.packetLossWarningPercent) || current.packetLossWarningPercent || 20,
        retryCountBeforeDown: Number(data.retryCountBeforeDown) || current.retryCountBeforeDown || 2
      };

      await this._writeJson(this.settingsFile, updated);

      await this._appendLogInternal({
        deviceId: null,
        device: 'System',
        event: 'SETTINGS_UPDATED',
        status: 'INFO',
        message: `System monitoring settings updated`
      });

      return updated;
    });
  }

  async getLogs({ page = 1, limit = 50, deviceId, event } = {}) {
    return this.mutex.runExclusive(async () => {
      const logs = await this._readJson(this.logsFile, []);
      let filtered = logs;

      if (deviceId) {
        filtered = filtered.filter(l => Number(l.deviceId) === Number(deviceId));
      }
      if (event) {
        filtered = filtered.filter(l => l.event.toLowerCase() === event.toLowerCase());
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

  async appendLog(logEntry) {
    return this.mutex.runExclusive(async () => {
      return this._appendLogInternal(logEntry);
    });
  }

  async _appendLogInternal(entry) {
    const logs = await this._readJson(this.logsFile, []);
    const newLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      deviceId: entry.deviceId || null,
      device: entry.device || 'System',
      event: entry.event || 'GENERAL',
      status: entry.status || 'INFO',
      message: entry.message || ''
    };
    logs.unshift(newLog);
    // Keep max 2000 log entries
    if (logs.length > 2000) {
      logs.length = 2000;
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

  // --- REPORT EXPORT ---
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
}

// Export singleton instance based on environment or default JSONDataStore
const defaultDataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
export const dataStore = new JSONDataStore(defaultDataDir);
export default dataStore;
