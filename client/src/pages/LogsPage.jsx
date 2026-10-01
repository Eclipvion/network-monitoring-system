import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldAlert,
  Server
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import api from '../services/api';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [eventFilter, setEventFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (targetPage = page, selectedEvent = eventFilter) => {
    try {
      setLoading(true);
      const res = await api.getLogs({
        page: targetPage,
        limit: 25,
        event: selectedEvent || undefined
      });
      setLogs(res.data || []);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      setTotalLogs(res.total || 0);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page, eventFilter);
  }, [page, eventFilter]);

  const handleEventChange = (e) => {
    setEventFilter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filter and Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={eventFilter}
            onChange={handleEventChange}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">All Audit Events</option>
            <option value="ALERT_DOWN">ALERT_DOWN (Outages)</option>
            <option value="RECOVERY">RECOVERY (Restorations)</option>
            <option value="DEVICE_CREATED">DEVICE_CREATED</option>
            <option value="DEVICE_UPDATED">DEVICE_UPDATED</option>
            <option value="DEVICE_DELETED">DEVICE_DELETED</option>
            <option value="ALERT_RESOLVED_MANUAL">ALERT_RESOLVED_MANUAL</option>
            <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
          </select>

          <span className="text-xs text-slate-400">
            {totalLogs} total records
          </span>
        </div>

        <button
          onClick={() => fetchLogs(page, eventFilter)}
          disabled={loading}
          className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-end sm:self-auto"
          title="Reload logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
        </button>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Target / Device</th>
                <th className="py-3.5 px-4">Event Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Message / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    {log.device || 'System'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {log.event}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={log.status} size="sm" pulse={false} />
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {log.message}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? 'Fetching logs...' : 'No activity logs found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
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
