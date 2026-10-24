const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch (e) {
      // Non-JSON response
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export const api = {
  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Devices
  getDevices: () => request('/devices'),
  createDevice: (device) => request('/devices', {
    method: 'POST',
    body: JSON.stringify(device),
  }),
  updateDevice: (id, device) => request(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(device),
  }),
  deleteDevice: (id) => request(`/devices/${id}`, {
    method: 'DELETE',
  }),
  deleteDevices: async (ids) => {
    try {
      return await request('/devices/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      // Fallback: If server hasn't been restarted yet and returns 404 for /batch-delete,
      // delete devices individually via DELETE /devices/:id which is already supported
      if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
        const results = [];
        for (const id of ids) {
          try {
            const res = await request(`/devices/${id}`, { method: 'DELETE' });
            results.push(res);
          } catch (e) {
            console.warn(`Failed to delete device ${id} in fallback:`, e);
          }
        }
        return { deletedCount: results.length, devices: results };
      }
      throw err;
    }
  },
  getDeviceStatus: (id) => request(`/devices/${id}/status`),
  getDeviceHistory: (id, range = '24h') => request(`/devices/${id}/history?range=${range}`),
  pingNow: (id) => request(`/devices/${id}/ping-now`, { method: 'POST' }),

  // Network Discovery & Instant Testing
  getNetworkInfo: () => request('/devices/network-info'),
  getPublicIp: () => request('/devices/public-ip'),
  scanNetwork: (params = {}) => request('/devices/scan-network', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  batchAddDevices: (devices) => request('/devices/batch-add', {
    method: 'POST',
    body: JSON.stringify({ devices }),
  }),
  testPing: (target, port = null, method = 'auto') => request('/devices/ping-test', {
    method: 'POST',
    body: JSON.stringify({ target, port, method }),
  }),

  // Alerts
  getAlerts: () => request('/alerts'),
  resolveAlert: (id) => request(`/alerts/${id}/resolve`, {
    method: 'POST',
  }),
  unresolveAlert: (id) => request(`/alerts/${id}/unresolve`, {
    method: 'POST',
  }),
  batchResolveAlerts: (ids) => request('/alerts/batch-resolve', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  }),
  batchUnresolveAlerts: (ids) => request('/alerts/batch-unresolve', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  }),
  batchDeleteAlerts: (ids) => request('/alerts/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  }),
  clearResolvedAlerts: () => request('/alerts/clear-resolved', {
    method: 'POST',
  }),
  deleteAlert: (id) => request(`/alerts/${id}`, {
    method: 'DELETE',
  }),

  // Logs
  getLogs: ({ page = 1, limit = 50, deviceId, event, severity, search, from, to } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (deviceId) params.append('deviceId', deviceId);
    if (event) params.append('event', event);
    if (severity) params.append('severity', severity);
    if (search) params.append('search', search);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return request(`/logs?${params.toString()}`);
  },

  getLogsExportUrl: (params = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.append('format', params.format || 'csv');
    if (params.deviceId) searchParams.append('deviceId', params.deviceId);
    if (params.event) searchParams.append('event', params.event);
    if (params.severity) searchParams.append('severity', params.severity);
    if (params.search) searchParams.append('search', params.search);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    return `/api/logs/export?${searchParams.toString()}`;
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
  testWebhook: (webhookUrl) => request('/settings/test-webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl }),
  }),
  clearStaleAlerts: () => request('/settings/clear-alerts', {
    method: 'POST',
  }),
  getSettingsBackupUrl: () => '/api/settings/backup',

  // Reports & Analytics
  getReportAnalytics: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.deviceId) searchParams.append('deviceId', params.deviceId);
    if (params.days) searchParams.append('days', params.days);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    if (params.type) searchParams.append('type', params.type);
    return request(`/reports/analytics?${searchParams.toString()}`);
  },

  getReportExportUrl: (params = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.append('format', params.format || 'html');
    if (params.deviceId) searchParams.append('deviceId', params.deviceId);
    if (params.days) searchParams.append('days', params.days);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    if (params.type) searchParams.append('type', params.type);
    return `/api/reports/export?${searchParams.toString()}`;
  },

  getMonitoringExportUrl: (params = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.append('format', params.format || 'csv');
    if (params.type && params.type !== 'ALL') searchParams.append('type', params.type);
    if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
    return `/api/monitoring/export?${searchParams.toString()}`;
  },

  // Diagnostics Suite
  runTraceroute: (params) => request('/diagnostics/traceroute', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getCachedTraceroute: (target) => request(`/diagnostics/traceroute/${encodeURIComponent(target)}`),
  runDiagnosticPing: (params) => request('/diagnostics/ping', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  runPortScan: (params) => request('/diagnostics/port-scan', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  runDnsLookup: (params) => request('/diagnostics/dns-lookup', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getDnsDirectory: () => request('/dns/directory'),
  runFullDnsBenchmark: (params) => request('/dns/benchmark-all', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  runSslCheck: (params) => request('/diagnostics/ssl-check', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // Security Hub & Cyber Threat Defense
  getSecurityOverview: () => request('/security/overview'),
  getSecurityAudits: () => request('/security/audits'),
  getPortsCatalog: () => request('/security/ports-catalog'),
  scanDeviceSecurity: (params) => request('/security/scan-device', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  scanAllSecurity: () => request('/security/scan-all', {
    method: 'POST',
  }),
  getDnsTraffic: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/security/dns-traffic${q ? `?${q}` : ''}`);
  },
  harvestDnsCache: () => request('/security/dns-harvest', {
    method: 'POST',
  }),
  clearDnsTraffic: () => request('/security/dns-traffic', {
    method: 'DELETE',
  }),
  getThreatAlerts: () => request('/security/threat-alerts'),
  resolveThreatAlert: (threatId) => request('/security/resolve-threat', {
    method: 'POST',
    body: JSON.stringify({ threatId }),
  }),
  probePort: (params) => request('/security/probe-port', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getArpGuardAnalysis: () => request('/security/arp-guard'),
  getRemediationScript: (format = 'powershell') => request(`/security/export-remediation?format=${format}`),
  getHoneypotStatus: () => request('/security/honeypot/status'),
  toggleHoneypot: (enabled) => request('/security/honeypot/toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  }),
  configHoneypot: (config) => request('/security/honeypot/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  getHoneypotLogs: (limit = 100) => request(`/security/honeypot/logs?limit=${limit}`),
  clearHoneypotLogs: () => request('/security/honeypot/logs', {
    method: 'DELETE',
  }),
  simulateHoneypotProbe: () => request('/security/honeypot/test-probe', {
    method: 'POST',
  }),

  // Zero-Trust Asset Guard & MAC Whitelist
  getAssetGuard: () => request('/security/asset-guard'),
  authorizeAsset: (data) => request('/security/asset-guard/authorize', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  authorizeAllAssets: (assets = []) => request('/security/asset-guard/authorize-all', {
    method: 'POST',
    body: JSON.stringify({ assets }),
  }),
  revokeAsset: (mac) => request('/security/asset-guard/revoke', {
    method: 'POST',
    body: JSON.stringify({ mac }),
  }),
  setAssetGuardMode: (zeroTrustMode) => request('/security/asset-guard/mode', {
    method: 'POST',
    body: JSON.stringify({ zeroTrustMode }),
  }),

  // Domain Health & SSL Certificate Hub
  getDomains: () => request('/domains'),
  addDomain: (data) => request('/domains', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateDomain: (id, data) => request(`/domains/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteDomain: (id) => request(`/domains/${id}`, {
    method: 'DELETE',
  }),
  checkDomainNow: (id) => request(`/domains/${id}/check-now`, {
    method: 'POST',
  }),
  checkAllDomains: () => request('/domains/check-all', {
    method: 'POST',
  }),
  getDomainHistory: (id, limit = 100) => request(`/domains/${id}/history?limit=${limit}`),
  quickProbeDomain: (domain) => request('/domains/quick-probe', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  }),

  // Telemetry: Bandwidth Throughput & SLA Outages
  getBandwidthTelemetry: () => request('/telemetry/bandwidth'),
  getOutageTelemetry: () => request('/telemetry/outages'),
  getSpeedTestTelemetry: () => request('/telemetry/speed-test'),
  runLiveSpeedTest: () => request('/telemetry/speed-test/run', { method: 'POST' }),

  // Scheduled Automated Email Reports
  getEmailReportConfig: () => request('/reports/email/config'),
  saveEmailReportConfig: (config) => request('/reports/email/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  testSmtpConnection: (config) => request('/reports/email/test-smtp', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  sendEmailReportNow: (payload = {}) => request('/reports/email/send-now', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Network Watchdog & Live Device Auto-Discovery
  getWatchdogStatus: () => request('/discovery/status'),
  triggerWatchdogSweep: () => request('/discovery/trigger-sweep', { method: 'POST' }),
  setWatchdogConfig: (config) => request('/discovery/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  getDiscoveryEvents: () => request('/discovery/events'),
};

export default api;
