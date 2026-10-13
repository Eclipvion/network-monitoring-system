import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Shield,
  ShieldAlert,
  Server,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import api from '../services/api';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [eventFilter, setEventFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (targetPage = page) => {
    try {
      setLoading(true);
      const res = await api.getLogs({
        page: targetPage,
        limit: 25,
        event: eventFilter || undefined,
        severity: severityFilter || undefined,
        search: searchTerm.trim() || undefined
      });
      setLogs(res.data || []);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      setTotalLogs(res.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, severityFilter, searchTerm]);

  useEffect(() => {
    fetchLogs(page);
  }, [page, eventFilter, severityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const handleEventChange = (e) => {
    setEventFilter(e.target.value);
    setPage(1);
  };

  const handleSeverityChange = (e) => {
    setSeverityFilter(e.target.value);
    setPage(1);
  };

  const handleExport = (format = 'csv') => {
    const url = api.getLogsExportUrl({
      format,
      event: eventFilter || undefined,
      severity: severityFilter || undefined,
      search: searchTerm.trim() || undefined
    });
    window.location.href = url;
  };

  const renderSeverityBadge = (severity = 'INFO') => {
    const sev = severity.toUpperCase();
    if (sev === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <XCircle className="w-3 h-3" /> CRITICAL
        </span>
      );
    }
    if (sev === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" /> WARNING
        </span>
      );
    }
    if (sev === 'SECURITY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <Shield className="w-3 h-3" /> SECURITY
        </span>
      );
    }
    if (sev === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> SUCCESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <Info className="w-3 h-3" /> INFO
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Compliance & Security Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tamper-evident system logs, operator attribution, device provisioning, and outage root-cause records.
          </p>
        </div>

        {/* Export & Refresh Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
            title="Download CSV Audit Trail"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            Export CSV
          </button>

          <button
            onClick={() => handleExport('json')}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
            title="Download JSON Audit Log"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            Export JSON
          </button>

          <button
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Keyword Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs by keyword, device, actor, or message..."
            className="w-full pl-9 pr-20 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={handleSeverityChange}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="SECURITY">Security / Config</option>
            <option value="SUCCESS">Success / Recovery</option>
            <option value="INFO">Info</option>
          </select>

          {/* Event Filter */}
          <select
            value={eventFilter}
            onChange={handleEventChange}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
          >
            <option value="">All Events</option>
            <option value="ALERT_DOWN">ALERT_DOWN (Outage)</option>
            <option value="RECOVERY">RECOVERY (Restored)</option>
            <option value="DEVICE_CREATED">DEVICE_CREATED</option>
            <option value="DEVICE_UPDATED">DEVICE_UPDATED</option>
            <option value="DEVICE_DELETED">DEVICE_DELETED</option>
            <option value="ALERT_RESOLVED_MANUAL">MANUAL_RESOLVED</option>
            <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
          </select>

          <span className="text-xs text-slate-400 whitespace-nowrap hidden lg:inline">
            {totalLogs.toLocaleString()} records
          </span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Target / Host</th>
                <th className="py-3.5 px-4">Event Type</th>
                <th className="py-3.5 px-4">Actor / Origin</th>
                <th className="py-3.5 px-4">Audit Details / Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {renderSeverityBadge(log.severity || log.status)}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    {log.device || 'System'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {log.event}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{log.actor || 'System'}</span>
                    </div>
                    {log.ip && (
                      <div className="font-mono text-[10px] text-slate-400 ml-4.5">
                        {log.ip}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {log.message}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? 'Fetching audit records...' : 'No audit records match the selected criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages} ({totalLogs} total records)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
