import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Key,
  Server,
  X,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import api from '../../services/api';

export default function ScheduledEmailModal({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    senderName: 'NetPulse Enterprise NOC',
    senderEmail: '',
    recipients: '',
    frequency: 'daily',
    scheduledHour: 9,
    daysToCover: 1
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [sendingNow, setSendingNow] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await api.getEmailReportConfig();
        if (res) {
          setConfig((prev) => ({
            ...prev,
            ...res,
            smtpPass: res.hasPassword ? '••••••••' : ''
          }));
        }
      } catch (err) {
        console.error('Failed to load email config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
    setTestResult(null);
    setSendResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.saveEmailReportConfig(config);
      setConfig((prev) => ({ ...prev, ...res }));
      alert('Email schedule configuration saved successfully!');
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testSmtpConnection(config);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSendNow = async () => {
    if (!config.recipients) {
      alert('Please specify at least one recipient email address.');
      return;
    }
    setSendingNow(true);
    setSendResult(null);
    try {
      const res = await api.sendEmailReportNow({
        recipients: config.recipients,
        days: config.frequency === 'weekly' ? 7 : 1
      });
      setSendResult({ success: true, message: `Report sent to ${res.sentTo}!` });
      setConfig((prev) => ({ ...prev, lastSentAt: res.sentAt, lastStatus: 'SUCCESS' }));
    } catch (err) {
      setSendResult({ success: false, message: err.message });
    } finally {
      setSendingNow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Automated Scheduled Email Reports</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/15 text-emerald-500">
                  SLA CRON
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically generate and email daily/weekly network health summaries directly to stakeholders.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Automation Switch */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Enable Automated Report Dispatch
              </span>
              <span className="text-[11px] text-slate-400">
                When enabled, the server automatically emails the executive report at the scheduled hour.
              </span>
            </div>

            <button
              onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                config.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                  config.enabled ? 'left-6.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Schedule Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Dispatch Frequency:</label>
              <select
                value={config.frequency}
                onChange={(e) => setConfig((p) => ({ ...p, frequency: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="daily">Daily Executive Summary</option>
                <option value="weekly">Weekly SLA Digest (Mondays)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Time of Day (Local Hour):</label>
              <select
                value={config.scheduledHour}
                onChange={(e) => setConfig((p) => ({ ...p, scheduledHour: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value={8}>08:00 AM (Morning Kickoff)</option>
                <option value={9}>09:00 AM (Standard Workday)</option>
                <option value={12}>12:00 PM (Midday)</option>
                <option value={18}>06:00 PM (Evening EOD)</option>
              </select>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1">
              Recipient Email Addresses (comma separated):
            </label>
            <input
              type="text"
              placeholder="admin@company.com, manager@domain.com"
              value={config.recipients}
              onChange={(e) => setConfig((p) => ({ ...p, recipients: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
            />
          </div>

          {/* SMTP Gateway Credentials */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-500" />
                SMTP Mail Relay Settings
              </span>
              <button
                onClick={handleTestSmtp}
                disabled={testing}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-2.5 rounded-xl font-mono text-[11px] flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span className="break-all">{testResult.message}</span>
              </div>
            )}

            {/* Smart Helper for Microsoft 365 Tenant SMTP Block */}
            {testResult && !testResult.success && (testResult.message.includes('SmtpClientAuthentication is disabled') || testResult.message.includes('5.7.139')) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Microsoft 365 Tenant Security Restriction:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Aapki organization / company ke Microsoft 365 domain ne <strong>SMTP Client Authentication</strong> ko default me disable kiya hua hai. Isko fix karne ke 2 tareeqay hain:
                </p>
                <div className="space-y-1 text-[11px] pl-1 font-sans">
                  <div>
                    <strong>1. Microsoft 365 Admin Center se Allow karein:</strong><br />
                    <code className="text-[10px] font-mono bg-amber-500/20 px-1 rounded">admin.microsoft.com</code> ➔ Users ➔ Active Users ➔ Apni email ➔ <em>Mail</em> tab ➔ <em>Manage email apps</em> ➔ <strong>"Authenticated SMTP"</strong> checkbox tick karein aur Save karein.
                  </div>
                  <div>
                    <strong>2. Ya Personal Outlook / Gmail use karein:</strong><br />
                    Personal Outlook (<code className="text-[10px] font-mono bg-amber-500/20 px-1 rounded">@outlook.com</code>, <code className="text-[10px] font-mono bg-amber-500/20 px-1 rounded">@hotmail.com</code>) ya Gmail App Password par ye organization block nahi hota.
                  </div>
                </div>
              </div>
            )}

            {/* Quick Email Service Provider Presets */}
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1.5">
                Choose Email Provider (Quick Presets)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfig((p) => ({
                    ...p,
                    smtpHost: 'smtp.office365.com',
                    smtpPort: 587,
                    smtpSecure: false
                  }))}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    config.smtpHost.includes('office365') || config.smtpHost.includes('outlook')
                      ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span>Outlook / M365</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((p) => ({
                    ...p,
                    smtpHost: 'smtp.gmail.com',
                    smtpPort: 587,
                    smtpSecure: false
                  }))}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    config.smtpHost.includes('gmail')
                      ? 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-red-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span>Gmail / Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((p) => ({
                    ...p,
                    smtpHost: 'smtp.mail.yahoo.com',
                    smtpPort: 587,
                    smtpSecure: false
                  }))}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    config.smtpHost.includes('yahoo')
                      ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 shadow-sm font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  <span>Yahoo Mail</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((p) => ({
                    ...p,
                    smtpHost: '',
                    smtpPort: 587,
                    smtpSecure: false
                  }))}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    !config.smtpHost.includes('office365') && !config.smtpHost.includes('outlook') && !config.smtpHost.includes('gmail') && !config.smtpHost.includes('yahoo')
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Custom SMTP</span>
                </button>
              </div>
            </div>

            {/* Provider Guidance Box */}
            {(config.smtpHost.includes('office365') || config.smtpHost.includes('outlook')) && (
              <div className="p-2.5 px-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>📘 Microsoft Outlook / Office 365 Setup Guide:</span>
                </div>
                <ul className="list-disc list-inside text-[10px] space-y-0.5 opacity-90 pl-1">
                  <li><strong>Username:</strong> Apna full Outlook email address daalein (e.g. <code className="font-mono bg-blue-500/20 px-1 rounded">user@outlook.com</code> ya <code className="font-mono bg-blue-500/20 px-1 rounded">admin@company.com</code>).</li>
                  <li><strong>Password:</strong> Agar Microsoft account par 2-Step Verification on hai, to Microsoft Account Security se <strong>App Password</strong> banakar use karein.</li>
                  <li><strong>Server:</strong> <code className="font-mono bg-blue-500/20 px-1 rounded">smtp.office365.com</code> • Port: <code className="font-mono bg-blue-500/20 px-1 rounded">587</code> (STARTTLS auto-handled).</li>
                </ul>
              </div>
            )}

            {config.smtpHost.includes('gmail') && (
              <div className="p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
                <div className="font-bold">📕 Google / Gmail Setup Guide:</div>
                <p className="text-[10px] opacity-90">
                  Gmail par normal password ki jagah Google Account &gt; Security &gt; 2-Step Verification &gt; <strong>App Passwords</strong> se 16-character App Password generate karke daalein.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">SMTP Host</label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={config.smtpHost}
                  onChange={(e) => setConfig((p) => ({ ...p, smtpHost: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Port</label>
                <input
                  type="number"
                  placeholder="587"
                  value={config.smtpPort}
                  onChange={(e) => setConfig((p) => ({ ...p, smtpPort: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Username / Email</label>
                <input
                  type="text"
                  placeholder="alerts@company.com"
                  value={config.smtpUser}
                  onChange={(e) => setConfig((p) => ({ ...p, smtpUser: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Password / App Key</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={config.smtpPass}
                  onChange={(e) => setConfig((p) => ({ ...p, smtpPass: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Send Result Callout */}
          {sendResult && (
            <div className={`p-3 rounded-xl font-mono text-[11px] flex items-center gap-2 ${
              sendResult.success
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
            }`}>
              {sendResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{sendResult.message}</span>
            </div>
          )}

          {/* Last Run Info */}
          {config.lastSentAt && (
            <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono pt-1">
              <span>Last Dispatched: {new Date(config.lastSentAt).toLocaleString()}</span>
              <span className={config.lastStatus === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}>
                Status: {config.lastStatus}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <button
            onClick={handleSendNow}
            disabled={sendingNow || !config.recipients}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Send className={`w-3.5 h-3.5 ${sendingNow ? 'animate-spin' : ''}`} />
            <span>{sendingNow ? 'Sending Report...' : 'Send Report Email Now'}</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
