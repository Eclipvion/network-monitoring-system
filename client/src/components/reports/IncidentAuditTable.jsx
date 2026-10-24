import React, { useState, useMemo } from 'react';
import { AlertTriangle, Search, CheckCircle2, Clock } from 'lucide-react';

export default function IncidentAuditTable({ incidents = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'RESOLVED' | 'ACTIVE'

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter === 'RESOLVED' && !inc.isResolved) return false;
      if (statusFilter === 'ACTIVE' && inc.isResolved) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = inc.deviceName?.toLowerCase().includes(q);
        const matchesIp = inc.deviceIp?.toLowerCase().includes(q);
        const matchesReason = inc.reason?.toLowerCase().includes(q);
        return matchesName || matchesIp || matchesReason;
      }
      return true;
    });
  }, [incidents, statusFilter, searchTerm]);

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Outage & Incident History (Failure Cause Analysis)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Audit logs of when device went DOWN, recovery timestamp, outage duration, and root cause error.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search incidents / cause..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
          >
            <option value="ALL">All Incidents ({incidents.length})</option>
            <option value="RESOLVED">Resolved Only</option>
            <option value="ACTIVE">Active Outages Only</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase text-slate-400">
              <th className="py-3 px-4">Device & Host</th>
              <th className="py-3 px-4">Went DOWN (Timestamp)</th>
              <th className="py-3 px-4">Recovered UP (Timestamp)</th>
              <th className="py-3 px-4">Outage Duration</th>
              <th className="py-3 px-4">Root Cause / Error Message</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredIncidents.length > 0 ? (
              filteredIncidents.map((inc) => {
                const isOngoing = !inc.isResolved;
                return (
                  <tr
                    key={inc.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      isOngoing ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {inc.deviceName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {inc.deviceIp}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-rose-500 font-medium">
                      {new Date(inc.downAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-mono font-medium">
                      {inc.upAt ? (
                        <span className="text-emerald-500">
                          {new Date(inc.upAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-rose-500 font-bold animate-pulse">
                          Currently Active (Down)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {inc.durationFormatted}
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs break-words">
                      {inc.reason}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOngoing
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 animate-pulse'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        }`}
                      >
                        {isOngoing ? 'ACTIVE OUTAGE' : 'RESOLVED'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="py-8 text-center text-xs text-slate-400">
                  {incidents.length === 0
                    ? '✓ 100% Stable: Zero downtime incidents recorded in this time period! All devices operating normally.'
                    : 'No incidents match the search filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
