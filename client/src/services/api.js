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
  getDeviceStatus: (id) => request(`/devices/${id}/status`),
  getDeviceHistory: (id, range = '24h') => request(`/devices/${id}/history?range=${range}`),
  pingNow: (id) => request(`/devices/${id}/ping-now`, { method: 'POST' }),

  // Network Discovery & Instant Testing
  getNetworkInfo: () => request('/devices/network-info'),
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
};

export default api;
