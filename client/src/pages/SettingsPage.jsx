import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import api from '../services/api';
import SettingsHeader from '../components/settings/SettingsHeader';
import SettingsTabsNav from '../components/settings/SettingsTabsNav';
import EngineThresholdsTab from '../components/settings/EngineThresholdsTab';
import IspWanTab from '../components/settings/IspWanTab';
import AlertsIntegrationsTab from '../components/settings/AlertsIntegrationsTab';
import BrandingSlaTab from '../components/settings/BrandingSlaTab';
import SslDnsTab from '../components/settings/SslDnsTab';
import SystemMaintenanceTab from '../components/settings/SystemMaintenanceTab';
import ResetConfirmModal from '../components/settings/ResetConfirmModal';

export default function SettingsPage({ onSettingsUpdated }) {
  const [activeTab, setActiveTab] = useState('engine');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [settings, setSettings] = useState({
    defaultInterval: 30,
    latencyWarningThresholdMs: 150,
    packetLossWarningPercent: 20,
    jitterWarningThresholdMs: 35,
    retryCountBeforeDown: 2,
    organizationName: 'NetPulse Enterprise NOC',
    reportSubtitle: 'Infrastructure SLA & Downtime Audit Report',
    slaTargetPercent: 99.9,
    reportLogoUrl: '',
    auditRetentionDays: 90,
    ispPublicIp: '',
    ispGatewayIp: '',
    ispName: '',
    ispPool: '',
    enableWebhookAlerts: false,
    webhookUrl: '',
    enableSoundAlerts: false,
    enableDesktopNotifications: false,
    maintenanceMode: false,
    dnsResolvers: [
      { name: 'Google', ip: '8.8.8.8' },
      { name: 'Cloudflare', ip: '1.1.1.1' },
      { name: 'Quad9', ip: '9.9.9.9' }
    ],
    dnsTestDomains: ['google.com', 'cloudflare.com'],
    dnsCheckIntervalSeconds: 300,
    sslWarningDaysThreshold: 14
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        setInitialLoading(true);
        const data = await api.getSettings();
        setSettings(prev => ({ ...prev, ...data }));
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings from server.');
      } finally {
        setInitialLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSetBulk = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSavedSuccess(false);

    try {
      setLoading(true);
      const updated = await api.updateSettings(settings);
      setSettings(prev => ({ ...prev, ...updated }));
      setSavedSuccess(true);
      setIsDirty(false);
      if (onSettingsUpdated) onSettingsUpdated(updated);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    try {
      setResetting(true);
      setError('');
      const res = await api.resetSettings();
      if (res.settings) {
        setSettings(res.settings);
        setIsDirty(false);
        setSavedSuccess(true);
        if (onSettingsUpdated) onSettingsUpdated(res.settings);
      }
      setShowResetModal(false);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      setError(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-xs font-mono font-bold tracking-wider">LOADING SYSTEM SETTINGS...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top Header Card */}
      <SettingsHeader
        maintenanceMode={settings.maintenanceMode}
        isDirty={isDirty}
        loading={loading}
        savedSuccess={savedSuccess}
        error={error}
        onSave={handleSave}
        onResetPrompt={() => setShowResetModal(true)}
      />

      {/* Tabs Navigation Pills */}
      <SettingsTabsNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        settings={settings}
      />

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {activeTab === 'engine' && (
          <EngineThresholdsTab settings={settings} onChange={handleChange} />
        )}

        {activeTab === 'isp' && (
          <IspWanTab settings={settings} onChange={handleChange} onSetBulk={handleSetBulk} />
        )}

        {activeTab === 'alerts' && (
          <AlertsIntegrationsTab settings={settings} onChange={handleChange} />
        )}

        {activeTab === 'branding' && (
          <BrandingSlaTab settings={settings} onChange={handleChange} />
        )}

        {activeTab === 'sslDns' && (
          <SslDnsTab settings={settings} onChange={handleChange} />
        )}

        {activeTab === 'maintenance' && (
          <SystemMaintenanceTab
            settings={settings}
            onResetPrompt={() => setShowResetModal(true)}
            onImportSuccess={(newSettings) => {
              setSettings(newSettings);
              setIsDirty(false);
              setSavedSuccess(true);
              if (onSettingsUpdated) onSettingsUpdated(newSettings);
            }}
          />
        )}

        {/* Sticky Action Footer */}
        <div className="p-4 rounded-2xl glass-panel-elevated flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDirty ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isDirty ? 'You have unsaved changes.' : 'All system settings are in sync with monitoring workers.'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal for Reset Defaults */}
      <ResetConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleConfirmReset}
        resetting={resetting}
      />
    </div>
  );
}
