import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  Clock,
  Activity,
  Wifi,
  ShieldAlert,
  Database,
  Globe,
  RefreshCw,
  Bell,
  Volume2,
  VolumeX,
  Send,
  Download,
  Trash2,
  Sliders,
  ExternalLink,
  Building,
  Check,
  AlertTriangle,
  Zap,
  Radio,
  FileText
} from 'lucide-react';
import api from '../services/api';
import {
  playAlertChime,
  requestNotificationPermission,
  sendDesktopNotification
} from '../utils/soundNotifications';

export default function SettingsPage({ onSettingsUpdated }) {
  const [activeTab, setActiveTab] = useState('engine'); // 'engine' | 'isp' | 'alerts' | 'branding' | 'maintenance'

  const [settings, setSettings] = useState({
    defaultInterval: 30,
    latencyWarningThresholdMs: 150,
    packetLossWarningPercent: 20,
    jitterWarningThresholdMs: 35,
    retryCountBeforeDown: 2,
    ispPublicIp: '',
    ispGatewayIp: '',
    ispName: '',
    ispPool: '',
    organizationName: 'NetPulse Enterprise NOC',
    reportSubtitle: 'Infrastructure SLA & Downtime Audit Report',
    slaTargetPercent: 99.9,
    reportLogoUrl: '',
    auditRetentionDays: 90,
    enableWebhookAlerts: false,
    webhookUrl: '',
    enableSoundAlerts: false,
    enableDesktopNotifications: false,
    maintenanceMode: false
  });

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [detectingPublicIp, setDetectingPublicIp] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  const [clearingAlerts, setClearingAlerts] = useState(false);
  const [clearAlertsResult, setClearAlertsResult] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
        setSettings(prev => ({ ...prev, ...data }));
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleAutoDetectPublicIp = async () => {
    try {
      setDetectingPublicIp(true);
      setError('');
      const res = await api.getPublicIp();
      if (res.ip && res.ip !== 'Unknown') {
        setSettings(prev => ({
          ...prev,
          ispPublicIp: res.ip,
          ispName: res.isp || prev.ispName || '',
          ispPool: res.poolSuggestion || prev.ispPool || `${res.ip}/24`
        }));
      } else {
        setError('Public IP auto-detect nahi ho saki. Please manual enter karein.');
      }
    } catch (e) {
      setError(`Public IP detection error: ${e.message}`);
    } finally {
      setDetectingPublicIp(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!settings.webhookUrl || !settings.webhookUrl.startsWith('http')) {
      setError('Please enter a valid HTTP/HTTPS Webhook URL first (e.g. Discord, Slack, or Webhook endpoint).');
      return;
    }
    try {
      setTestingWebhook(true);
      setWebhookTestResult(null);
      setError('');
      const res = await api.testWebhook(settings.webhookUrl);
      setWebhookTestResult({ success: true, message: res.message });
      setTimeout(() => setWebhookTestResult(null), 5000);
    } catch (err) {
      setWebhookTestResult({ success: false, message: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleClearStaleAlerts = async () => {
    try {
      setClearingAlerts(true);
      setClearAlertsResult(null);
      const res = await api.clearStaleAlerts();
      setClearAlertsResult({ success: true, message: res.message });
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setClearAlertsResult(null), 5000);
    } catch (err) {
      setClearAlertsResult({ success: false, message: err.message });
    } finally {
      setClearingAlerts(false);
    }
  };

  const handleRequestDesktopPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
    if (granted) {
      setSettings(prev => ({ ...prev, enableDesktopNotifications: true }));
      sendDesktopNotification('NetPulse Notifications Enabled', 'You will receive instant desktop alerts for device outages.');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSavedSuccess(false);

    try {
      setLoading(true);
      const updated = await api.updateSettings(settings);
      setSettings(prev => ({ ...prev, ...updated }));
      setSavedSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated(updated);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'engine', label: 'Engine & Thresholds', icon: Sliders, badge: `${settings.defaultInterval}s` },
    { id: 'isp', label: 'ISP & WAN Uplink', icon: Globe, badge: settings.ispName || 'Live WAN' },
    { id: 'alerts', label: 'Alerts & Integrations', icon: Bell, badge: settings.enableWebhookAlerts ? 'Webhook ON' : 'Alerts' },
    { id: 'branding', label: 'Branding & SLA', icon: Building, badge: `${settings.slaTargetPercent}%` },
    { id: 'maintenance', label: 'System & Backup', icon: Database, badge: 'Storage' }
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl glass-panel-elevated relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Enterprise System Settings
                </h2>
                {settings.maintenanceMode && (
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Maintenance Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure background polling cadence, PRTG jitter alerts, webhook triggers, ISP sensors, and SLA reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <a
              href={api.getSettingsBackupUrl ? api.getSettingsBackupUrl() : '/api/settings/backup'}
              download
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
              title="Download full configuration JSON backup"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </a>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save All Changes'}</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {savedSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Configuration saved successfully! Changes are applied across the Node server and Python polling engine.</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-500/80">SYNCHRONIZED</span>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Categorized Tab Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                  : 'bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isActive
                    ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Settings Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: Engine & Thresholds */}
        {/* ========================================================================= */}
        {activeTab === 'engine' && (
          <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-500" />
                Monitoring Engine Cadence & Threshold Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fine-tune multi-layer probe intervals, timeout thresholds, and PRTG-grade jitter sensitivity across all nodes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Default Interval */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Default Polling Interval
                  </label>
                  <span className="font-mono text-xs font-bold text-emerald-500">
                    {settings.defaultInterval}s
                  </span>
                </div>
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={settings.defaultInterval}
                  onChange={(e) => setSettings({ ...settings, defaultInterval: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
                <div className="flex items-center gap-1.5 pt-1">
                  {[5, 10, 15, 30, 60].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSettings({ ...settings, defaultInterval: val })}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        settings.defaultInterval === val
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-emerald-500'
                      }`}
                    >
                      {val}s
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Global polling cycle cadence for endpoints without custom intervals.
                </p>
              </div>

              {/* Retries Before Down */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Anti-Flapping Retry Count
                  </label>
                  <span className="font-mono text-xs font-bold text-blue-500">
                    {settings.retryCountBeforeDown} retries
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.retryCountBeforeDown}
                  onChange={(e) => setSettings({ ...settings, retryCountBeforeDown: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Required consecutive missed probes before declaring a device DOWN (prevents false alarms).
                </p>
              </div>

              {/* Latency Warning Threshold */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Latency Warning Threshold
                  </label>
                  <span className="font-mono text-xs font-bold text-amber-500">
                    {settings.latencyWarningThresholdMs} ms
                  </span>
                </div>
                <input
                  type="number"
                  min="5"
                  max="5000"
                  value={settings.latencyWarningThresholdMs}
                  onChange={(e) => setSettings({ ...settings, latencyWarningThresholdMs: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Pings exceeding this threshold flag the host with a WARNING state.
                </p>
              </div>

              {/* Packet Loss Threshold */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Packet Loss Threshold
                  </label>
                  <span className="font-mono text-xs font-bold text-rose-500">
                    {settings.packetLossWarningPercent}%
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.packetLossWarningPercent}
                  onChange={(e) => setSettings({ ...settings, packetLossWarningPercent: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Percentage of dropped probe packets that transitions a host to WARNING.
                </p>
              </div>

              {/* RFC 3550 Jitter Warning Threshold */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      RFC 3550 Jitter Alert Threshold (PRTG / QoS)
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-mono">
                      VoIP / Audio Stability
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-cyan-500">
                    ±{settings.jitterWarningThresholdMs || 35} ms
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="number"
                    min="2"
                    max="500"
                    step="0.5"
                    value={settings.jitterWarningThresholdMs || 35}
                    onChange={(e) => setSettings({ ...settings, jitterWarningThresholdMs: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    required
                  />
                  <div className="flex items-center gap-2">
                    {[
                      { label: 'Strict VoIP (< 15ms)', val: 15 },
                      { label: 'Standard (< 35ms)', val: 35 },
                      { label: 'Tolerant (< 60ms)', val: 60 }
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setSettings({ ...settings, jitterWarningThresholdMs: preset.val })}
                        className={`text-xs px-2.5 py-2 rounded-xl border transition-all ${
                          settings.jitterWarningThresholdMs === preset.val
                            ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 font-bold'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-cyan-500'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  When consecutive packet latency variation exceeds this threshold, the link is flagged for high jitter / VoIP degradation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ISP & WAN Uplink */}
        {/* ========================================================================= */}
        {activeTab === 'isp' && (
          <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-500" />
                  ISP Internet & Public WAN IP Pool Configuration
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure the Public IP or CIDR Subnet Pool assigned by your ISP. This powers the live WAN vs LAN status sensor.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAutoDetectPublicIp}
                disabled={detectingPublicIp}
                className="px-4 py-2 rounded-xl text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${detectingPublicIp ? 'animate-spin' : ''}`} />
                <span>{detectingPublicIp ? 'Detecting WAN IP...' : '⚡ Auto-Detect My Public IP & ISP'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* ISP Public WAN IP */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  ISP Public WAN IP
                </label>
                <input
                  type="text"
                  value={settings.ispPublicIp || ''}
                  onChange={(e) => setSettings({ ...settings, ispPublicIp: e.target.value })}
                  placeholder="e.g. 103.86.52.79 or 39.45.12.34"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <p className="text-[11px] text-slate-400">
                  Your ISP-assigned static or dynamic public IPv4 address.
                </p>
              </div>

              {/* ISP Provider Name */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  ISP Provider / Carrier Name
                </label>
                <input
                  type="text"
                  value={settings.ispName || ''}
                  onChange={(e) => setSettings({ ...settings, ispName: e.target.value })}
                  placeholder="e.g. Optix, Nayatel, PTCL, StormFiber, Transworld"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <p className="text-[11px] text-slate-400">
                  Carrier brand displayed on the Executive ISP banner.
                </p>
              </div>

              {/* ISP WAN Gateway IP */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  ISP Gateway IP (Upstream Hop)
                </label>
                <input
                  type="text"
                  value={settings.ispGatewayIp || ''}
                  onChange={(e) => setSettings({ ...settings, ispGatewayIp: e.target.value })}
                  placeholder="e.g. 103.86.52.1 or 39.45.12.1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <p className="text-[11px] text-slate-400">
                  The upstream provider router address directly connected to your ONT/Modem.
                </p>
              </div>

              {/* ISP Public IP Pool / Subnet */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Public CIDR IP Pool / Block
                </label>
                <input
                  type="text"
                  value={settings.ispPool || ''}
                  onChange={(e) => setSettings({ ...settings, ispPool: e.target.value })}
                  placeholder="e.g. 103.86.52.0/24 or 39.45.12.32/29"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <p className="text-[11px] text-slate-400">
                  Assigned corporate IP subnet range for this office / branch connection.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: Alerts & Integrations */}
        {/* ========================================================================= */}
        {activeTab === 'alerts' && (
          <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Real-Time Outage Alerts, Webhooks & Sound Notifications
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure notification channels to alert your NOC team via Discord, Slack, audio beeps, or desktop push notifications.
              </p>
            </div>

            {/* Maintenance Mode Master Switch */}
            <div className={`p-4 rounded-xl border transition-all ${
              settings.maintenanceMode
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Maintenance Window Mode
                    </span>
                    {settings.maintenanceMode && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.2 rounded-full bg-amber-500 text-white font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Suppresses all outward webhooks and alarm chimes during scheduled maintenance windows.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.maintenanceMode)}
                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>

            {/* Webhook Integrations Section */}
            <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    Outgoing Outage Webhook (Discord / Slack / Teams)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Automatically dispatches rich embedded outage & recovery alerts to your team chat channel.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.enableWebhookAlerts)}
                    onChange={(e) => setSettings({ ...settings, enableWebhookAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              {settings.enableWebhookAlerts && (
                <div className="space-y-3 pt-2 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Webhook Target URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={settings.webhookUrl || ''}
                        onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                        placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      <button
                        type="button"
                        onClick={handleTestWebhook}
                        disabled={testingWebhook || !settings.webhookUrl}
                        className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                      >
                        <Send className={`w-3 h-3 ${testingWebhook ? 'animate-pulse' : ''}`} />
                        <span>{testingWebhook ? 'Sending...' : 'Test Webhook'}</span>
                      </button>
                    </div>
                  </div>

                  {webhookTestResult && (
                    <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      webhookTestResult.success
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {webhookTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                      <span>{webhookTestResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sound & Desktop Notifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sound Chimes */}
              <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-emerald-500" />
                      Audible NOC Alarms
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Plays audio chime when a server or connection fails.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableSoundAlerts)}
                      onChange={(e) => setSettings({ ...settings, enableSoundAlerts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => playAlertChime('alarm')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 flex items-center gap-1 transition-colors"
                  >
                    🔊 Test Outage Alarm
                  </button>
                  <button
                    type="button"
                    onClick={() => playAlertChime('recovery')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1 transition-colors"
                  >
                    🔔 Test Recovery Ping
                  </button>
                </div>
              </div>

              {/* Desktop Push Notifications */}
              <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-purple-500" />
                      Desktop Push Notifications
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Native OS notifications even when the browser is minimized.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableDesktopNotifications)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSettings({ ...settings, enableDesktopNotifications: checked });
                        if (checked && notificationPermission !== 'granted') {
                          handleRequestDesktopPermission();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                    notificationPermission === 'granted'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    Permission: {notificationPermission}
                  </span>
                  {notificationPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestDesktopPermission}
                      className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Allow Permissions →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: Branding & SLA */}
        {/* ========================================================================= */}
        {activeTab === 'branding' && (
          <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-500" />
                Enterprise White-Labeling & Customer SLA Benchmarks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Customize corporate identity, PDF audit report titles, logo headers, and target uptime SLA compliance targets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Organization Name */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Organization / NOC Name
                </label>
                <input
                  type="text"
                  value={settings.organizationName || ''}
                  onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                  placeholder="e.g. NetPulse Enterprise NOC"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-semibold"
                />
                <p className="text-[11px] text-slate-400">
                  Printed on executive PDF SLA audit reports and white-label exports.
                </p>
              </div>

              {/* Report Subtitle */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Report Header Title
                </label>
                <input
                  type="text"
                  value={settings.reportSubtitle || ''}
                  onChange={(e) => setSettings({ ...settings, reportSubtitle: e.target.value })}
                  placeholder="e.g. Infrastructure SLA & Downtime Audit Report"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <p className="text-[11px] text-slate-400">
                  Executive subtitle for generated audit reports.
                </p>
              </div>

              {/* SLA Target % */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Uptime SLA Target Commitment (%)
                  </label>
                  <span className="font-mono text-xs font-bold text-emerald-500">
                    {settings.slaTargetPercent ?? 99.9}%
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="50"
                  max="100"
                  value={settings.slaTargetPercent ?? 99.9}
                  onChange={(e) => setSettings({ ...settings, slaTargetPercent: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    { label: '99.0% (Two 9s)', val: 99.0 },
                    { label: '99.5%', val: 99.5 },
                    { label: '99.9% (Three 9s)', val: 99.9 },
                    { label: '99.99% (Four 9s)', val: 99.99 }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setSettings({ ...settings, slaTargetPercent: p.val })}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        settings.slaTargetPercent === p.val
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-emerald-500'
                      }`}
                    >
                      {p.val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Logo URL */}
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Custom Logo URL (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={settings.reportLogoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, reportLogoUrl: e.target.value })}
                    placeholder="https://yourcompany.com/logo.png"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  {settings.reportLogoUrl && (
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={settings.reportLogoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Replaces the default NetPulse shield logo on exported customer documentation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: System & Maintenance */}
        {/* ========================================================================= */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Quick Maintenance Actions */}
            <div className="p-6 rounded-2xl glass-panel space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  System Health & Alert Housekeeping
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Perform database maintenance operations and clean up stale alerts from deleted or recovered hosts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Clear Stale & Orphan Outage Alerts
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Auto-resolves alerts for devices that are currently UP or have been removed from monitoring.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearStaleAlerts}
                    disabled={clearingAlerts}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${clearingAlerts ? 'animate-spin' : ''}`} />
                    <span>{clearingAlerts ? 'Housekeeping...' : '🧹 Clean Stale Alerts Now'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Full Configuration Backup (JSON)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Export complete system settings, credentials, thresholds, and monitored endpoint metadata.
                    </p>
                  </div>
                  <a
                    href={api.getSettingsBackupUrl ? api.getSettingsBackupUrl() : '/api/settings/backup'}
                    download
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>💾 Download Backup JSON</span>
                  </a>
                </div>
              </div>

              {clearAlertsResult && (
                <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  clearAlertsResult.success
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{clearAlertsResult.message}</span>
                </div>
              )}
            </div>

            {/* Architecture Details Card */}
            <div className="p-6 rounded-2xl glass-panel space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                Data Layer Architecture & Zero-Collision Concurrency
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                NetPulse operates on a high-throughput atomic <code className="font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">JSONDataStore</code> backend protected by an asynchronous mutex queue. Real-time updates from Python workers and WebSocket subscribers serialize safely without disk file lock collisions.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Retention Limit</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">3,000 Entries</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Audit Trail</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">{settings.auditRetentionDays || 90} Days</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Engine Mode</span>
                  <span className="font-bold font-mono text-emerald-500">Multi-Layer NOC</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Socket Sync</span>
                  <span className="font-bold font-mono text-cyan-500">Sub-10ms Live</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Save Footer */}
        <div className="p-4 rounded-2xl glass-panel-elevated flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Changes apply instantly across real-time telemetry and reporting.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
