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
import DomainHealthPage from './pages/DomainHealthPage';
import SecurityHubPage from './pages/SecurityHubPage';
import TopologyPage from './pages/TopologyPage';
import DeviceModal from './components/DeviceModal';
import DeviceDetailsModal from './components/DeviceDetailsModal';
import api from './services/api';
import { getSocket } from './services/socket';
import { Trash2, AlertTriangle } from 'lucide-react';
import { playAlertChime, sendDesktopNotification } from './utils/soundNotifications';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  // State
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const appSettingsRef = React.useRef(null);
  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  // Modals state
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [deletingDevices, setDeletingDevices] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  // Auto-Refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('auto_refresh_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoRefreshInterval, setAutoRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('auto_refresh_interval');
    return saved ? Math.max(2, Number(saved)) : 5; // Default 5 seconds
  });

  const [countdown, setCountdown] = useState(autoRefreshInterval);

  // Load Dashboard Data (silent=true avoids screen flickering on interval poll)
  const refreshAllData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [sumRes, devRes, alertRes, setRes] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.getDevices().catch(() => []),
        api.getAlerts().catch(() => []),
        api.getSettings().catch(() => null)
      ]);
      if (sumRes) setSummary(sumRes);
      if (setRes) setAppSettings(setRes);
      // Merge summary status into devices
      const statusMap = new Map(((sumRes && sumRes.devices) || []).map(d => [d.id, d]));
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
      if (!silent) setLoading(false);
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setCountdown(autoRefreshInterval);
    await refreshAllData(false);
  }, [autoRefreshInterval, refreshAllData]);

  const handleToggleAutoRefresh = (enabled) => {
    setAutoRefreshEnabled(enabled);
    localStorage.setItem('auto_refresh_enabled', String(enabled));
    if (enabled) {
      setCountdown(autoRefreshInterval);
    }
  };

  const handleChangeInterval = (newInterval) => {
    const validInterval = Math.max(2, Number(newInterval) || 5);
    setAutoRefreshInterval(validInterval);
    localStorage.setItem('auto_refresh_interval', String(validInterval));
    setCountdown(validInterval);
    if (!autoRefreshEnabled) {
      setAutoRefreshEnabled(true);
      localStorage.setItem('auto_refresh_enabled', 'true');
    }
  };

  // Initial load
  useEffect(() => {
    refreshAllData(false);
  }, [refreshAllData]);

  // Auto-Refresh Countdown Timer Effect
  useEffect(() => {
    if (!autoRefreshEnabled || autoRefreshInterval <= 0) return;

    setCountdown(autoRefreshInterval);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger silent background poll
          refreshAllData(true);
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshInterval, refreshAllData]);

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

      // Update devices list in-place instantly
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
                jitter: payload.jitter,
                trafficIn: payload.trafficIn,
                trafficOut: payload.trafficOut,
                speedMbps: payload.speedMbps,
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

      // Update summary stats in background without lag
      setSummary((prevSummary) => {
        if (!prevSummary) return prevSummary;
        api.getDashboard().then(setSummary).catch(() => {});
        return prevSummary;
      });
    };

    // Real-time alert:new event
    const handleNewAlert = (alertPayload) => {
      setAlerts((prev) => [alertPayload, ...prev]);
      api.getDashboard().then(setSummary).catch(() => {});

      const cur = appSettingsRef.current;
      if (cur && !cur.maintenanceMode) {
        if (cur.enableSoundAlerts) {
          playAlertChime('alarm');
        }
        if (cur.enableDesktopNotifications) {
          sendDesktopNotification(
            `🚨 Host Down: ${alertPayload.deviceName || 'Device'}`,
            alertPayload.message || 'Host is unreachable'
          );
        }
      }
    };

    // Real-time alert:resolved event
    const handleAlertResolved = (resolvedPayload) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === resolvedPayload.id ? { ...a, resolved: true, resolvedAt: resolvedPayload.resolvedAt } : a))
      );
      api.getDashboard().then(setSummary).catch(() => {});

      const cur = appSettingsRef.current;
      if (cur && cur.enableSoundAlerts && !cur.maintenanceMode) {
        playAlertChime('recovery');
      }
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
    if (!deletingDevices || deletingDevices.length === 0) return;
    try {
      if (deletingDevices.length === 1) {
        await api.deleteDevice(deletingDevices[0].id);
      } else {
        await api.deleteDevices(deletingDevices.map((d) => d.id));
      }
      setDeletingDevices(null);
      await refreshAllData();
    } catch (err) {
      alert(`Error deleting device(s): ${err.message}`);
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

  const handleUnresolveAlert = async (alertId) => {
    await api.unresolveAlert(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: false, resolvedAt: null } : a))
    );
    api.getDashboard().then(setSummary).catch(() => {});
  };

  const activeAlertCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#080c14] text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation (Desktop Persistent + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={activeAlertCount}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
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
          onRefresh={handleManualRefresh}
          loading={loading}
          autoRefreshEnabled={autoRefreshEnabled}
          onToggleAutoRefresh={handleToggleAutoRefresh}
          autoRefreshInterval={autoRefreshInterval}
          onChangeInterval={handleChangeInterval}
          countdown={countdown}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        {/* Dynamic Page Content (Responsive auto-sized padding) */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6">
          <div className="max-w-7xl mx-auto w-full">
            {/* Global Maintenance Mode Notification Banner */}
            {appSettings?.maintenanceMode && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold uppercase tracking-wider block text-[10px] text-amber-600 dark:text-amber-400">
                      Maintenance Window Active
                    </span>
                    <span>Continuous polling active, but outward webhooks and audio chimes are currently suppressed.</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold transition-colors"
                >
                  Configure →
                </button>
              </div>
            )}

            {activeTab === 'overview' && (
              <OverviewPage
                summary={summary || { devices }}
                devices={devices}
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
                onDeleteDevice={(dev) => setDeletingDevices([dev])}
                onDeleteMultipleDevices={(devs) => setDeletingDevices(devs)}
                onToggleMonitoring={handleToggleMonitoring}
                onOpenDetails={handleOpenDetails}
                onRefreshDevices={handleManualRefresh}
              />
            )}

            {activeTab === 'topology' && (
              <TopologyPage
                devices={devices}
                onRefreshDevices={handleManualRefresh}
                onOpenDetails={handleOpenDetails}
              />
            )}

            {activeTab === 'monitoring' && (
              <MonitoringPage
                devices={devices}
                liveEvents={liveEvents}
                onOpenDetails={handleOpenDetails}
                onRefreshDevices={handleManualRefresh}
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
              <DomainHealthPage
                devices={devices}
              />
            )}

            {activeTab === 'security' && (
              <SecurityHubPage
                devices={devices}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsPage
                alerts={alerts}
                onResolveAlert={handleResolveAlert}
                onUnresolveAlert={handleUnresolveAlert}
                loading={loading}
                onRefresh={refreshAllData}
              />
            )}

            {activeTab === 'logs' && <LogsPage />}

            {activeTab === 'settings' && (
              <SettingsPage onSettingsUpdated={(updated) => {
                if (updated) setAppSettings(updated);
                refreshAllData(true);
              }} />
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

      {/* Delete Confirmation Modal (Single or Multi/Batch) */}
      {deletingDevices && deletingDevices.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {deletingDevices.length === 1
                    ? 'Delete Device?'
                    : `Delete ${deletingDevices.length} Devices?`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {deletingDevices.length === 1
                    ? 'This device will be permanently removed from monitoring.'
                    : `These ${deletingDevices.length} devices will be removed from monitoring.`}
                </p>
              </div>
            </div>

            {deletingDevices.length === 1 ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{deletingDevices[0].name}</strong> ({deletingDevices[0].ip})? Historical logs will be preserved.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Are you sure you want to delete these <strong>{deletingDevices.length}</strong> devices?
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                  {deletingDevices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate mr-2">{d.name}</span>
                      <span className="font-mono text-slate-400 text-[11px] shrink-0">{d.ip}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Historical logs will be preserved.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingDevices(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingDevices.length === 1 ? 'Confirm Delete' : `Delete All ${deletingDevices.length}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
