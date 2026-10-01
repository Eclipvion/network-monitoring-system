import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  Clock,
  Activity,
  Wifi,
  ShieldAlert,
  Database
} from 'lucide-react';
import api from '../services/api';

export default function SettingsPage({ onSettingsUpdated }) {
  const [settings, setSettings] = useState({
    defaultInterval: 30,
    latencyWarningThresholdMs: 150,
    packetLossWarningPercent: 20,
    retryCountBeforeDown: 2
  });
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSavedSuccess(false);

    try {
      setLoading(true);
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setSavedSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated(updated);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="p-6 rounded-2xl glass-panel space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-500" />
            Monitoring Engine Thresholds & Defaults
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            These rules control how the Python background worker evaluates host health and when DOWN / WARNING alerts trigger.
          </p>
        </div>

        {savedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Settings saved successfully! Python worker will apply these settings on the next cycle.
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Default Interval */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Default Ping Interval (seconds)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={settings.defaultInterval}
                  onChange={(e) => setSettings({ ...settings, defaultInterval: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Fallback polling cadence applied to newly added devices.
              </p>
            </div>

            {/* Retries Before Down */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Consecutive Fails Before DOWN
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.retryCountBeforeDown}
                onChange={(e) => setSettings({ ...settings, retryCountBeforeDown: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
              <p className="text-[11px] text-slate-400">
                Number of consecutive failed probe cycles before raising DOWN outage alert.
              </p>
            </div>

            {/* Latency Warning Threshold */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Latency Warning Threshold (ms)
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                value={settings.latencyWarningThresholdMs}
                onChange={(e) => setSettings({ ...settings, latencyWarningThresholdMs: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
              <p className="text-[11px] text-slate-400">
                Pings exceeding this threshold flag the device with a WARNING state.
              </p>
            </div>

            {/* Packet Loss Threshold */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Packet Loss Warning Threshold (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.packetLossWarningPercent}
                onChange={(e) => setSettings({ ...settings, packetLossWarningPercent: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
              <p className="text-[11px] text-slate-400">
                Probe packet drop percentage that triggers a WARNING state.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Database Architecture Info */}
      <div className="p-6 rounded-2xl glass-panel space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-500" />
          Data Layer Architecture (Phase 1)
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Storage is managed via <code className="font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">JSONDataStore</code> implementing <code className="font-mono text-slate-700 dark:text-slate-300">BaseDataStore</code>. File writes are serialized with an in-memory asynchronous mutex to eliminate concurrent race conditions between API endpoints and the Python engine. Retention automatically limits monitoring history to 500 entries per device or 7 days.
        </p>
      </div>
    </div>
  );
}
