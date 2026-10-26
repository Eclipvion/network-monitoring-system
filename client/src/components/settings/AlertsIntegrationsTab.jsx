import React, { useState } from 'react';
import {
  Bell,
  Send,
  Volume2,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import api from '../../services/api';
import {
  playAlertChime,
  requestNotificationPermission,
  sendDesktopNotification
} from '../../utils/soundNotifications';

export default function AlertsIntegrationsTab({ settings, onChange }) {
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState(null);
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const handleTestWebhook = async () => {
    if (!settings.webhookUrl || !settings.webhookUrl.startsWith('http')) {
      setWebhookResult({
        success: false,
        message: 'Please enter a valid HTTP/HTTPS Webhook URL (e.g. Discord, Slack, Teams).'
      });
      return;
    }
    try {
      setTestingWebhook(true);
      setWebhookResult(null);
      const res = await api.testWebhook(settings.webhookUrl);
      setWebhookResult({ success: true, message: res.message });
      setTimeout(() => setWebhookResult(null), 6000);
    } catch (err) {
      setWebhookResult({ success: false, message: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) {
      onChange('enableDesktopNotifications', true);
      sendDesktopNotification(
        'NetPulse Alerts Active',
        'You will now receive desktop push notifications during network outages.'
      );
    }
  };

  return (
    <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          Real-Time Outage Alerts, Webhooks & Sound Notifications
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Instant alerts via Discord, Slack, Microsoft Teams, browser sound alarms, and native OS desktop alerts.
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Maintenance Window Mode
              </span>
              {settings.maintenanceMode && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono">
                  SUPPRESSION ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Temporarily halts outgoing webhooks and audio alarms during scheduled server maintenance.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.maintenanceMode)}
              onChange={(e) => onChange('maintenanceMode', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      {/* Outgoing Webhook Section */}
      <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              Outgoing Outage Webhook (Discord / Slack / Teams)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Broadcasts structured JSON outage and recovery alerts to your NOC channels.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.enableWebhookAlerts)}
              onChange={(e) => onChange('enableWebhookAlerts', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        {settings.enableWebhookAlerts && (
          <div className="space-y-3 pt-2 animate-in fade-in duration-150">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Webhook Target Endpoint URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={settings.webhookUrl || ''}
                  onChange={(e) => onChange('webhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !settings.webhookUrl}
                  className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0 shadow-md shadow-blue-500/20 active:scale-95"
                >
                  <Send className={`w-3.5 h-3.5 ${testingWebhook ? 'animate-pulse' : ''}`} />
                  <span>{testingWebhook ? 'Testing...' : 'Test Webhook'}</span>
                </button>
              </div>
            </div>

            {webhookResult && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                webhookResult.success
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
              }`}>
                {webhookResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{webhookResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sound & Desktop Notifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Audible NOC Alarms */}
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-500" />
                Audible NOC Alarms
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Play synthesized Web Audio chimes on device status change.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.enableSoundAlerts)}
                onChange={(e) => onChange('enableSoundAlerts', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => playAlertChime('alarm')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all active:scale-95"
            >
              🔊 Test Outage Alarm
            </button>
            <button
              type="button"
              onClick={() => playAlertChime('recovery')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all active:scale-95"
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
                Operating system popups even if the tab is in background.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.enableDesktopNotifications)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange('enableDesktopNotifications', checked);
                  if (checked && permission !== 'granted') {
                    handleRequestPermission();
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
              permission === 'granted'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
            }`}>
              Status: {permission}
            </span>
            {permission !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Request Permission →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
