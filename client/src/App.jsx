import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import OverviewPage from './pages/OverviewPage';
import DevicesPage from './pages/DevicesPage';
import MonitoringPage from './pages/MonitoringPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import DiagnosticsPage from './pages/DiagnosticsPage';
import DnsPerformancePage from './pages/DnsPerformancePage';
import DeviceModal from './components/DeviceModal';
import DeviceDetailsModal from './components/DeviceDetailsModal';
import api from './services/api';
import { getSocket } from './services/socket';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  // State
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState(null);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Load Initial Data
  const refreshAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, devRes, alertRes] = await Promise.all([
        api.getDashboard(),
        api.getDevices(),
        api.getAlerts()
      ]);
      setSummary(sumRes);
      // Merge summary status into devices
      const statusMap = new Map((sumRes.devices || []).map(d => [d.id, d]));
      const enrichedDevices = devRes.map(d => {
        const enriched = statusMap.get(d.id);
        return {
          ...d,
          status: enriched?.status || (d.monitoring ? 'PENDING' : 'PAUSED'),
          latestResult: enriched?.latestResult || null
        };
      });
      setDevices(enrichedDevices);
      setAlerts(alertRes);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // WebSocket Setup
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      console.log('[Socket] Connected to server');
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      console.log('[Socket] Disconnected from server');
      setSocketConnected(false);
    };

    // Real-time device:status event
    const handleDeviceStatus = (payload) => {
      setLastUpdated(new Date().toISOString());

      // Update devices list in-place
      setDevices((prevDevices) =>
        prevDevices.map((d) => {
          if (Number(d.id) === Number(payload.deviceId)) {
            return {
              ...d,
              status: payload.status,
              latestResult: {
                timestamp: payload.timestamp,
                status: payload.status,
                latency: payload.latency,
                packetLoss: payload.packetLoss,
                message: payload.message
              }
            };
          }
          return d;
        })
      );

      // Append to liveEvents stream (limit to latest 40)
      setLiveEvents((prev) => [
        {
          id: `${payload.deviceId}-${Date.now()}`,
          ...payload
        },
        ...prev.slice(0, 39)
      ]);

      // Update dashboard summary stats dynamically
      setSummary((prevSummary) => {
        if (!prevSummary) return prevSummary;
        // Trigger quick refresh of summary in background
        api.getDashboard().then(setSummary).catch(() => {});
        return prevSummary;
      });
    };

    // Real-time alert:new event
    const handleNewAlert = (alertPayload) => {
      setAlerts((prev) => [alertPayload, ...prev]);
      api.getDashboard().then(setSummary).catch(() => {});
    };

    // Real-time alert:resolved event
    const handleAlertResolved = (resolvedPayload) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === resolvedPayload.id ? { ...a, resolved: true, resolvedAt: resolvedPayload.resolvedAt } : a))
      );
      api.getDashboard().then(setSummary).catch(() => {});
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('device:status', handleDeviceStatus);
    socket.on('alert:new', handleNewAlert);
    socket.on('alert:resolved', handleAlertResolved);

    if (socket.connected) {
      setSocketConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('device:status', handleDeviceStatus);
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:resolved', handleAlertResolved);
    };
  }, []);

  // Handlers for Device Management
  const handleOpenAddDevice = () => {
    setEditingDevice(null);
    setIsDeviceModalOpen(true);
  };

  const handleOpenEditDevice = (device) => {
    setEditingDevice(device);
    setIsDeviceModalOpen(true);
  };

  const handleSaveDevice = async (formData) => {
    if (editingDevice) {
      await api.updateDevice(editingDevice.id, formData);
    } else {
      await api.createDevice(formData);
    }
    await refreshAllData();
  };

  const handleToggleMonitoring = async (deviceId, newMonitoringState) => {
    try {
      await api.updateDevice(deviceId, { monitoring: newMonitoringState });
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, monitoring: newMonitoringState, status: newMonitoringState ? (d.status === 'PAUSED' ? 'PENDING' : d.status) : 'PAUSED' }
            : d
        )
      );
    } catch (err) {
      console.error('Failed to toggle monitoring:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDevice) return;
    try {
      await api.deleteDevice(deletingDevice.id);
      setDeletingDevice(null);
      await refreshAllData();
    } catch (err) {
      alert(`Error deleting device: ${err.message}`);
    }
  };

  const handleOpenDetails = (deviceId) => {
    setSelectedDeviceId(deviceId);
    setIsDetailsModalOpen(true);
  };

  const handleResolveAlert = async (alertId) => {
    await api.resolveAlert(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a))
    );
    api.getDashboard().then(setSummary).catch(() => {});
  };

  const activeAlertCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={activeAlertCount}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <Navbar
          activeTab={activeTab}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          socketConnected={socketConnected}
          lastUpdated={lastUpdated}
          onRefresh={refreshAllData}
          loading={loading}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <OverviewPage
                summary={summary || { devices }}
                onOpenDeviceDetails={handleOpenDetails}
                onOpenAddDevice={handleOpenAddDevice}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'devices' && (
              <DevicesPage
                devices={devices}
                onAddDevice={handleOpenAddDevice}
                onEditDevice={handleOpenEditDevice}
                onDeleteDevice={(dev) => setDeletingDevice(dev)}
                onToggleMonitoring={handleToggleMonitoring}
                onOpenDetails={handleOpenDetails}
                onRefreshDevices={refreshAllData}
              />
            )}

            {activeTab === 'monitoring' && (
              <MonitoringPage
                devices={devices}
                liveEvents={liveEvents}
                onOpenDetails={handleOpenDetails}
                onRefreshDevices={refreshAllData}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsPage
                devices={devices}
                initialDeviceId="all"
              />
            )}

            {activeTab === 'diagnostics' && (
              <DiagnosticsPage
                devices={devices}
                initialTool="traceroute"
              />
            )}

            {activeTab === 'dns' && (
              <DnsPerformancePage />
            )}

            {activeTab === 'domains' && (
              <DiagnosticsPage
                devices={devices}
                initialTool="ssl"
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsPage
                alerts={alerts}
                onResolveAlert={handleResolveAlert}
                loading={loading}
                onRefresh={refreshAllData}
              />
            )}

            {activeTab === 'logs' && <LogsPage />}

            {activeTab === 'settings' && (
              <SettingsPage onSettingsUpdated={refreshAllData} />
            )}
          </div>
        </main>
      </div>

      {/* Add / Edit Device Modal */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSave={handleSaveDevice}
        device={editingDevice}
        defaultInterval={30}
      />

      {/* Device Details & Historical Telemetry Modal */}
      <DeviceDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        deviceId={selectedDeviceId}
      />

      {/* Delete Confirmation Modal */}
      {deletingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Delete Device?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{deletingDevice.name}</strong> ({deletingDevice.ip})? Historical logs will be preserved.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingDevice(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md shadow-rose-500/20 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
