import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Clock,
  ShieldAlert,
  Activity,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Check,
  Users,
  BellRing,
  Zap,
  Power
} from 'lucide-react';
import api from '../../services/api';

/**
 * Reusable High-Contrast Segmented ON / OFF Auto-Switch Button
 * Clearly visible in both Light Mode and Dark Mode on all screen sizes.
 */
function AutoToggleSwitch({ enabled, onChange, onLabel = 'AUTO ON', offLabel = 'OFF', disabled = false }) {
  return (
    <div className="inline-flex items-center rounded-xl p-1 bg-slate-200/90 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 shrink-0 shadow-inner">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !enabled && onChange(true)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
          enabled
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            enabled ? 'bg-white animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
          }`}
        />
        <span>{onLabel}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => enabled && onChange(false)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold tracking-wide transition-all cursor-pointer ${
          !enabled
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        {offLabel}
      </button>
    </div>
  );
}

export default function EmailCenterTab() {
  const [config, setConfig] = useState({
    enabled: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    senderName: 'NetPulse Enterprise NOC',
    senderEmail: '',
    recipients: '',
    recipientList: [],
    frequency: 'daily',
    scheduledHour: 9,
    daysToCover: 1,
    autoSendOutageAlerts: true,
    autoSendSecurityAlerts: true,
    autoSendCriticalSearchAlerts: true,
    lastSentAt: null,
    lastStatus: null,
    lastError: null,
    dispatchHistory: [],
    hasPassword: false
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  // Add new email recipient input states
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newRoleInput, setNewRoleInput] = useState('NOC Admin');

  // 1-Click Report Dispatch Loading states
  const [dispatchingType, setDispatchingType] = useState(null); // 'SLA' | 'ALERTS' | 'SECURITY' | 'SEARCHES'

  const loadEmailConfig = async () => {
    try {
      setLoading(true);
      const res = await api.getEmailReportConfig();
      if (res) {
        setConfig((prev) => ({
          ...prev,
          ...res,
          recipientList: Array.isArray(res.recipientList) ? res.recipientList : [],
          dispatchHistory: Array.isArray(res.dispatchHistory) ? res.dispatchHistory : [],
          smtpPass: res.hasPassword ? '••••••••' : ''
        }));
      }
    } catch (err) {
      setStatusBanner({ type: 'error', text: `Failed to load email settings: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmailConfig();
  }, []);

  // Auto-save helper whenever recipient list or switches change
  const persistConfig = async (nextConfig, feedbackText = 'Email configuration saved!') => {
    try {
      setSaving(true);
      const saved = await api.saveEmailReportConfig(nextConfig);
      setConfig((prev) => ({
        ...prev,
        ...saved,
        smtpPass: saved.hasPassword ? '••••••••' : prev.smtpPass
      }));
      setStatusBanner({ type: 'success', text: feedbackText });
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err) {
      setStatusBanner({ type: 'error', text: `Save failed: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Add a recipient email to the saved list and auto-save immediately
  const handleAddRecipient = async (e) => {
    if (e) e.preventDefault();
    const raw = newEmailInput.trim().toLowerCase();
    if (!raw || !raw.includes('@')) {
      setStatusBanner({ type: 'error', text: 'Please enter a valid email address (e.g. admin@company.com).' });
      return;
    }

    const emailsToAdd = raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.includes('@'));

    const currentList = Array.isArray(config.recipientList) ? [...config.recipientList] : [];
    let addedCount = 0;

    emailsToAdd.forEach((emailAddr) => {
      const exists = currentList.some((r) => r.email.toLowerCase() === emailAddr);
      if (!exists) {
        currentList.push({
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          email: emailAddr,
          label: newRoleInput || 'NOC Recipient',
          enabled: true
        });
        addedCount += 1;
      }
    });

    if (addedCount === 0) {
      setStatusBanner({ type: 'error', text: 'This email address is already in your Saved Recipient List.' });
      return;
    }

    setNewEmailInput('');
    const updated = { ...config, recipientList: currentList };
    setConfig(updated);
    await persistConfig(updated, `Added ${addedCount} email(s) to Auto-Saved Recipient List!`);
  };

  const handleToggleRecipient = async (id) => {
    const updatedList = (config.recipientList || []).map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    const updated = { ...config, recipientList: updatedList };
    setConfig(updated);
    await persistConfig(updated, 'Recipient status updated & auto-saved!');
  };

  const handleRemoveRecipient = async (id, email) => {
    const updatedList = (config.recipientList || []).filter((r) => r.id !== id);
    const updated = { ...config, recipientList: updatedList };
    setConfig(updated);
    await persistConfig(updated, `Removed ${email} from recipient list.`);
  };

  const handleSetAutoRule = async (key, nextVal, label) => {
    const updated = { ...config, [key]: Boolean(nextVal) };
    setConfig(updated);
    await persistConfig(
      updated,
      `${label}: ${nextVal ? 'ENABLED (Auto-Send ON)' : 'DISABLED (OFF)'}`
    );
  };

  const handleToggleAllAutoEmails = async (enableAll) => {
    const updated = {
      ...config,
      enabled: enableAll,
      autoSendOutageAlerts: enableAll,
      autoSendSecurityAlerts: enableAll,
      autoSendCriticalSearchAlerts: enableAll
    };
    setConfig(updated);
    await persistConfig(
      updated,
      enableAll
        ? 'All Automated Email Alerts & Scheduled Reports turned ON!'
        : 'All Automated Email Triggers paused (Manual 1-Click Send still available).'
    );
  };

  const handleTestSmtp = async () => {
    try {
      setTestingSmtp(true);
      setStatusBanner(null);
      const res = await api.testSmtpConnection(config);
      if (res.success) {
        setStatusBanner({ type: 'success', text: res.message });
        await loadEmailConfig();
      } else {
        setStatusBanner({ type: 'error', text: res.message });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', text: `SMTP Test Failed: ${err.message}` });
    } finally {
      setTestingSmtp(false);
    }
  };

  // Instant 1-Click Report Dispatchers
  const handleInstantDispatch = async (reportType) => {
    try {
      setDispatchingType(reportType);
      setStatusBanner(null);

      await api.saveEmailReportConfig(config);

      let res;
      if (reportType === 'SLA') {
        res = await api.sendEmailReportNow({ days: config.frequency === 'weekly' ? 7 : 1 });
      } else if (reportType === 'ALERTS') {
        res = await api.sendAlertsEmailReport();
      } else if (reportType === 'SECURITY') {
        res = await api.sendSecurityEmailReport();
      } else if (reportType === 'SEARCHES') {
        res = await api.sendUserSearchEmailReport();
      }

      setStatusBanner({
        type: 'success',
        text: `✅ Executive Report emailed successfully to: ${res.sentTo}`
      });
      await loadEmailConfig();
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: `❌ Dispatch failed: ${err.message}`
      });
    } finally {
      setDispatchingType(null);
    }
  };

  const activeRecipientsCount = (config.recipientList || []).filter((r) => r.enabled !== false).length;
  const isSmtpReady = Boolean(config.smtpHost && config.smtpUser && (config.hasPassword || config.smtpPass));
  const allAutoEnabled = Boolean(
    config.enabled && config.autoSendOutageAlerts && config.autoSendSecurityAlerts
  );

  if (loading) {
    return (
      <div className="p-10 rounded-2xl glass-panel text-center text-slate-500 dark:text-slate-400 text-xs font-mono">
        Loading Enterprise Email & Notification Center...
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
      {/* TOP EXECUTIVE BANNER (TABLE-WISE LEFT-ALIGNED TOOLBAR) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        {/* Row 1: Title & Subtitle on Left, Status Badges on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Mail className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Enterprise Email &amp; Auto-Dispatch Center
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure your SMTP account once and manage recipients for Outage Alerts, Security Reports, User Search Audits &amp; Executive SLA Reports
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isSmtpReady
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}
            >
              {isSmtpReady ? `● SMTP Ready (${config.smtpHost})` : '⚠️ SMTP Setup Required'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              {activeRecipientsCount} Recipient(s)
            </span>
          </div>
        </div>

        {/* Row 2: Table-Wise Left-Aligned Action Buttons */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-start gap-2">
          <button
            type="button"
            onClick={() => persistConfig(config, 'All email settings & recipients saved!')}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Email Config'}</span>
          </button>
        </div>
      </div>

      {/* STATUS FEEDBACK BANNER */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 border shadow-sm ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="break-words">{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] font-semibold underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: SAVED RECIPIENT EMAIL LIST (AUTO-SAVES ON ADD / TOGGLE)
         ===================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Saved Recipient Email Directory (Auto-Save List)</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Jis jis email par aap ne alerts aur reports bhejni hain unhein yahan add kar dein — har email auto-save hoti hai.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 self-start sm:self-auto">
            {activeRecipientsCount} of {(config.recipientList || []).length} Receiving Emails
          </span>
        </div>

        {/* Add Email Form */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="email"
            value={newEmailInput}
            onChange={(e) => setNewEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddRecipient(e);
              }
            }}
            placeholder="Enter recipient email (e.g. abdul.rafay@ability.com.pk, soc@company.com)..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          <select
            value={newRoleInput}
            onChange={(e) => setNewRoleInput(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="NOC Admin">NOC Admin</option>
            <option value="Management / Executive">Management / Executive</option>
            <option value="IT Security">IT Security</option>
            <option value="Operations">Operations</option>
          </select>
          <button
            type="button"
            onClick={handleAddRecipient}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add &amp; Auto-Save Email</span>
          </button>
        </div>

        {/* Saved Email List Cards */}
        {(config.recipientList || []).length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
            No recipient emails saved yet. Add your email address above (e.g. <code>abdul.rafay@ability.com.pk</code>) to enable 1-click &amp; automated reports.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {(config.recipientList || []).map((rec) => {
              const isEnabled = rec.enabled !== false;
              return (
                <div
                  key={rec.id || rec.email}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                    isEnabled
                      ? 'bg-white dark:bg-slate-900 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isEnabled
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {rec.email.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-white truncate">
                        {rec.email}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span>{rec.label || 'NOC Recipient'}</span>
                        <span>•</span>
                        <span className={isEnabled ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-500 font-semibold'}>
                          {isEnabled ? '● Active (Receiving)' : '○ Muted'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRecipient(rec.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all border ${
                        isEnabled
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-emerald-500 hover:text-white'
                      }`}
                    >
                      {isEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(rec.id, rec.email)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Remove Email"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 2: 1-CLICK INSTANT REPORT DISPATCHER (ALL 4 MODULES)
         ===================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>1-Click Instant Report Dispatch (Send Professional Email Report Now)</span>
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Kisi bhi card par click karein — foran upar wali Active Email List ({activeRecipientsCount} recipients) par executive HTML report + smart suggestions chali jayegi.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => handleInstantDispatch('SLA')}
            disabled={Boolean(dispatchingType)}
            className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-500/10 hover:bg-emerald-100/80 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-left transition-all cursor-pointer disabled:opacity-50 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-black text-xs">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>SLA &amp; Uptime Report</span>
              </span>
              <Send className={`w-3.5 h-3.5 shrink-0 ${dispatchingType === 'SLA' ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {dispatchingType === 'SLA' ? 'Sending SLA Report...' : 'Send availability, latency & SLA suggestions'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleInstantDispatch('ALERTS')}
            disabled={Boolean(dispatchingType)}
            className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-500/10 hover:bg-amber-100/80 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 text-left transition-all cursor-pointer disabled:opacity-50 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-black text-xs">
              <span className="flex items-center gap-1.5">
                <BellRing className="w-4 h-4 shrink-0" />
                <span>Network Alerts Report</span>
              </span>
              <Send className={`w-3.5 h-3.5 shrink-0 ${dispatchingType === 'ALERTS' ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {dispatchingType === 'ALERTS' ? 'Sending Alerts...' : 'Send active outages, incident log & fixes'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleInstantDispatch('SECURITY')}
            disabled={Boolean(dispatchingType)}
            className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-500/10 hover:bg-rose-100/80 dark:hover:bg-rose-500/20 border border-rose-300 dark:border-rose-500/30 text-left transition-all cursor-pointer disabled:opacity-50 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-black text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Security &amp; Threat Report</span>
              </span>
              <Send className={`w-3.5 h-3.5 shrink-0 ${dispatchingType === 'SECURITY' ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {dispatchingType === 'SECURITY' ? 'Sending Security Audit...' : 'Send cyber score, open ports & SOC plan'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleInstantDispatch('SEARCHES')}
            disabled={Boolean(dispatchingType)}
            className="p-4 rounded-2xl bg-cyan-50/80 dark:bg-cyan-500/10 hover:bg-cyan-100/80 dark:hover:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/30 text-left transition-all cursor-pointer disabled:opacity-50 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-400 font-black text-xs">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 shrink-0" />
                <span>User Searches Report</span>
              </span>
              <Send className={`w-3.5 h-3.5 shrink-0 ${dispatchingType === 'SEARCHES' ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {dispatchingType === 'SEARCHES' ? 'Sending Search Audit...' : 'Send user searches, Restricted & Critical hits'}
            </p>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION 3: AUTO-EMAIL TRIGGER RULES & SCHEDULE (NEW CLEAR ON/OFF BUTTONS)
         ===================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Automated Email Triggers &amp; Scheduled Auto-Send Controls</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Har rule ke samne <strong>AUTO ON / OFF</strong> button hai — click karte hi setting auto-save ho jati hai.
            </p>
          </div>

          {/* Master All-In-One Quick Toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleToggleAllAutoEmails(!allAutoEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border shadow-sm ${
                allAutoEnabled
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-200 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{allAutoEnabled ? 'All Auto-Emails: ON' : 'Turn All Auto-Emails ON'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Trigger 1: Outage & Recovery */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
              config.autoSendOutageAlerts
                ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-300 dark:border-emerald-500/30'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>🚨 Real-Time Device Outage &amp; Recovery Emails</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Jab koi device <strong>DOWN</strong> ya wapis <strong>UP</strong> hogi to foran saved email list par alert chala jayega.
              </div>
            </div>
            <AutoToggleSwitch
              enabled={Boolean(config.autoSendOutageAlerts)}
              onChange={(val) => handleSetAutoRule('autoSendOutageAlerts', val, 'Outage & Recovery Auto-Email')}
            />
          </div>

          {/* Trigger 2: Security & Policy Threats */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
              config.autoSendSecurityAlerts
                ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-300 dark:border-emerald-500/30'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>🛡️ Security Threats &amp; Critical User Searches</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Jab High/Critical port threat ya Critical search policy violation hogi to foran auto-email jayegi.
              </div>
            </div>
            <AutoToggleSwitch
              enabled={Boolean(config.autoSendSecurityAlerts)}
              onChange={(val) => handleSetAutoRule('autoSendSecurityAlerts', val, 'Security & Search Threat Auto-Email')}
            />
          </div>
        </div>

        {/* Scheduled Daily / Weekly Report */}
        <div
          className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
            config.enabled
              ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-300 dark:border-indigo-500/30'
              : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Scheduled Daily / Weekly Executive SLA Report (Auto-Cron)</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Rozana ya haftay mein ek dafa muqarrar waqt par mukammal Executive Report khud-ba-khud email ho jayegi.
              </div>
            </div>
            <AutoToggleSwitch
              enabled={Boolean(config.enabled)}
              onChange={(val) => handleSetAutoRule('enabled', val, 'Scheduled Executive Report Auto-Send')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Schedule Frequency
              </label>
              <select
                value={config.frequency}
                onChange={(e) => {
                  const updated = { ...config, frequency: e.target.value };
                  setConfig(updated);
                  persistConfig(updated, 'Schedule frequency saved!');
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="daily">Daily Executive Summary (Every Day)</option>
                <option value="weekly">Weekly SLA Digest (Every Monday)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Auto-Dispatch Time (Local Hour)
              </label>
              <select
                value={config.scheduledHour}
                onChange={(e) => {
                  const updated = { ...config, scheduledHour: Number(e.target.value) };
                  setConfig(updated);
                  persistConfig(updated, 'Schedule time saved!');
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value={8}>08:00 AM (Morning Kickoff)</option>
                <option value={9}>09:00 AM (Standard Workday)</option>
                <option value={12}>12:00 PM (Midday Briefing)</option>
                <option value={18}>06:00 PM (Evening EOD Summary)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 4: ONE-TIME GLOBAL SMTP MAIL RELAY CREDENTIALS
         ===================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Global SMTP Mail Relay Configuration (Configure Once)</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Apna Gmail App Password yahan ek dafa save kar dein — tamam modules isi SMTP account ko use karenge.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestSmtp}
            disabled={testingSmtp}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingSmtp ? 'animate-spin' : ''}`} />
            <span>{testingSmtp ? 'Verifying SMTP...' : 'Test & Save SMTP Connection'}</span>
          </button>
        </div>

        {/* Provider Quick Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                smtpSecure: false
              }))
            }
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              config.smtpHost.includes('gmail')
                ? 'bg-red-500/15 border-red-500 text-red-700 dark:text-red-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Gmail (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                smtpHost: 'smtp.office365.com',
                smtpPort: 587,
                smtpSecure: false
              }))
            }
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              config.smtpHost.includes('office365') || config.smtpHost.includes('outlook')
                ? 'bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Outlook / M365</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                smtpHost: 'smtp.mail.yahoo.com',
                smtpPort: 587,
                smtpSecure: false
              }))
            }
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              config.smtpHost.includes('yahoo')
                ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Yahoo Mail</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                smtpHost: '',
                smtpPort: 587,
                smtpSecure: false
              }))
            }
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Custom SMTP</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
              SMTP Host
            </label>
            <input
              type="text"
              value={config.smtpHost}
              onChange={(e) => setConfig((p) => ({ ...p, smtpHost: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
              SMTP Port
            </label>
            <input
              type="number"
              value={config.smtpPort}
              onChange={(e) => setConfig((p) => ({ ...p, smtpPort: Number(e.target.value) }))}
              placeholder="587"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
              Sender Display Name
            </label>
            <input
              type="text"
              value={config.senderName}
              onChange={(e) => setConfig((p) => ({ ...p, senderName: e.target.value }))}
              placeholder="NetPulse Enterprise NOC"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
              SMTP Username / Email Address
            </label>
            <input
              type="text"
              value={config.smtpUser}
              onChange={(e) => setConfig((p) => ({ ...p, smtpUser: e.target.value }))}
              placeholder="your.email@gmail.com"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
              SMTP Password / 16-Char App Password
            </label>
            <input
              type="password"
              value={config.smtpPass}
              onChange={(e) => setConfig((p) => ({ ...p, smtpPass: e.target.value }))}
              placeholder="••••••••••••••••"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 5: RECENT EMAIL DELIVERY AUDIT LOG
         ===================================================================== */}
      {(config.dispatchHistory || []).length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Recent Email Delivery Audit Log ({config.dispatchHistory.length})
          </h4>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {config.dispatchHistory.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {item.subject}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    To: {item.recipients} • {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 self-start sm:self-auto ${
                    item.status === 'SUCCESS'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
