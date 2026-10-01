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

  // Alerts
  getAlerts: () => request('/alerts'),
  resolveAlert: (id) => request(`/alerts/${id}/resolve`, {
    method: 'POST',
  }),

  // Logs
  getLogs: ({ page = 1, limit = 50, deviceId, event } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (deviceId) params.append('deviceId', deviceId);
    if (event) params.append('event', event);
    return request(`/logs?${params.toString()}`);
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
};

export default api;
