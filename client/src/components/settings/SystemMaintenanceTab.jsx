import React, { useState, useRef } from 'react';
import {
  Database,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Cpu
} from 'lucide-react';
import api from '../../services/api';

export default function SystemMaintenanceTab({
  settings,
  onResetPrompt,
  onImportSuccess
}) {
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleClearStaleAlerts = async () => {
    try {
      setClearing(true);
      setClearResult(null);
      const res = await api.clearStaleAlerts();
      setClearResult({ success: true, message: res.message });
      setTimeout(() => setClearResult(null), 5000);
    } catch (err) {
      setClearResult({ success: false, message: err.message });
    } finally {
      setClearing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportResult(null);
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await api.importSettings(parsed);
      setImportResult({ success: true, message: res.message });
      if (onImportSuccess) onImportSuccess(res.settings);
      setTimeout(() => setImportResult(null), 5000);
    } catch (err) {
      setImportResult({ success: false, message: `Import error: ${err.message}` });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Maintenance Actions Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-5">
        <div className="border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500" />
            System Health, Backups & Alert Housekeeping
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Perform database maintenance, clean orphan outage alerts, export JSON configurations, and import restore archives.
          </p>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Housekeeping */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                Clean Orphan Alerts
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Auto-resolves alerts for devices that are UP or removed from monitoring.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearStaleAlerts}
              disabled={clearing}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
              <span>{clearing ? 'Cleaning...' : '🧹 Clean Stale Alerts'}</span>
            </button>
          </div>

          {/* Backup Export */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-blue-500" />
                Full Backup JSON
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Export complete system settings, endpoints, credentials, and thresholds.
              </p>
            </div>
            <a
              href={api.getSettingsBackupUrl()}
              download
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>💾 Download Backup</span>
            </a>
          </div>

          {/* Restore / Import */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-500" />
                Restore / Import JSON
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Restore settings from an exported configuration backup file.
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{importing ? 'Importing...' : '📂 Import Config JSON'}</span>
            </button>
          </div>
        </div>

        {clearResult && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            clearResult.success
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{clearResult.message}</span>
          </div>
        )}

        {importResult && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            importResult.success
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{importResult.message}</span>
          </div>
        )}
      </div>

      {/* Architecture & Mutex Stats Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          Data Layer Architecture & Mutex Concurrency
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          NetPulse leverages an asynchronous mutex queue on an atomic JSON data store. Simultaneous telemetry updates from Python workers and WebSocket subscribers serialize safely without disk file lock collisions.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Cache Layer</span>
            <span className="font-bold font-mono text-emerald-500">In-Memory Buffering</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Audit Retention</span>
            <span className="font-bold font-mono text-slate-900 dark:text-white">{settings.auditRetentionDays || 90} Days</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Engine Mode</span>
            <span className="font-bold font-mono text-slate-900 dark:text-white">Multi-Layer NOC</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Socket Sync</span>
            <span className="font-bold font-mono text-cyan-500">Sub-10ms Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
