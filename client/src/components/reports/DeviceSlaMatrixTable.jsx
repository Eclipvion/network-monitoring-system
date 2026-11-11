import React, { useState, useMemo } from 'react';
import { Server, Search, ChevronRight, X, RotateCcw, ArrowUpDown } from 'lucide-react';

export default function DeviceSlaMatrixTable({
  deviceSummaries = [],
  onSelectDevice,
  selectedDeviceId = 'all',
  filterDays = 7
}) {
  const [deviceSearch, setDeviceSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UP' | 'DOWN' | 'WARNING' | 'FLAPPING'
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'lowest_uptime' | 'most_outages' | 'highest_latency'

  const filteredSummaries = useMemo(() => {
    const list = deviceSummaries.filter((dev) => {
      if (typeFilter !== 'ALL' && dev.type?.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (statusFilter === 'FLAPPING' && !dev.isFlapping) return false;
      if (statusFilter !== 'ALL' && statusFilter !== 'FLAPPING' && dev.currentStatus !== statusFilter) {
        return false;
      }
      if (deviceSearch.trim()) {
        const q = deviceSearch.toLowerCase();
        return dev.name?.toLowerCase().includes(q) || dev.ip?.toLowerCase().includes(q);
      }
      return true;
    });

    if (sortBy === 'lowest_uptime') {
      return [...list].sort((a, b) => (a.uptimePercent ?? 100) - (b.uptimePercent ?? 100));
    }
    if (sortBy === 'most_outages') {
      return [...list].sort((a, b) => (b.incidentsCount || 0) - (a.incidentsCount || 0));
    }
    if (sortBy === 'highest_latency') {
      const getLat = (d) => (typeof d.avgLatency === 'number' ? d.avgLatency : -1);
      return [...list].sort((a, b) => getLat(b) - getLat(a));
    }
    return list;
  }, [deviceSummaries, typeFilter, statusFilter, deviceSearch, sortBy]);

  const uniqueTypes = useMemo(() => {
    const set = new Set(deviceSummaries.map((d) => d.type).filter(Boolean));
    return Array.from(set);
  }, [deviceSummaries]);

  const hasFilters = Boolean(
    deviceSearch.trim() || typeFilter !== 'ALL' || statusFilter !== 'ALL' || sortBy !== 'default'
  );

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
      {/* Table Header Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500" />
            Network Device Inventory &amp; SLA Matrix ({filterDays} Days)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Individual uptime audit, probe counts, outage frequency, and response latency per monitored host.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedDeviceId !== 'all' && onSelectDevice && (
            <button
              onClick={() => onSelectDevice('all')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Show All Devices</span>
            </button>
          )}

          {/* Search with Clear X */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search devices / IP..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            {deviceSearch && (
              <button
                onClick={() => setDeviceSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium cursor-pointer"
          >
            <option value="ALL">All Status ({deviceSummaries.length})</option>
            <option value="UP">Online (UP)</option>
            <option value="DOWN">Offline (DOWN)</option>
            <option value="WARNING">Warning</option>
            <option value="FLAPPING">Flapping Only</option>
          </select>

          {/* Type Filter */}
          {uniqueTypes.length > 0 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium capitalize cursor-pointer"
            >
              <option value="ALL">All Types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* Sort By */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pl-7 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium cursor-pointer"
            >
              <option value="default">Default Order</option>
              <option value="lowest_uptime">Lowest Uptime First</option>
              <option value="most_outages">Most Outages First</option>
              <option value="highest_latency">Highest Latency First</option>
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setDeviceSearch('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setSortBy('default');
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset table filters and sort"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* SLA Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase text-slate-400">
              <th className="py-3 px-4">Device Name</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Probes</th>
              <th className="py-3 px-4 text-right">Uptime %</th>
              <th className="py-3 px-4 text-right">Outages (Downtime)</th>
              <th className="py-3 px-4 text-right">Avg Latency</th>
              <th className="py-3 px-4 text-center">Current Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredSummaries.length > 0 ? (
              filteredSummaries.map((dev) => {
                const isUp = dev.currentStatus === 'UP';
                const isDown = dev.currentStatus === 'DOWN';
                const isWarn = dev.currentStatus === 'WARNING';

                let badgeColor = 'bg-slate-500/10 text-slate-500';
                if (isUp) badgeColor = 'bg-emerald-500/10 text-emerald-500';
                else if (isDown) badgeColor = 'bg-rose-500/10 text-rose-500';
                else if (isWarn) badgeColor = 'bg-amber-500/10 text-amber-500';

                const uptimeVal = dev.uptimePercent ?? 100;
                const barColor =
                  uptimeVal >= 99
                    ? 'bg-emerald-500'
                    : uptimeVal >= 95
                    ? 'bg-amber-500'
                    : 'bg-rose-500';

                return (
                  <tr
                    key={dev.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{dev.name}</span>
                        {dev.isFlapping && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            FLAPPING
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {dev.ip}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-500 dark:text-slate-400">
                      {dev.type}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-300">
                      {dev.totalChecks}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-col items-end gap-1 min-w-[72px]">
                        <span
                          className={`font-mono font-bold ${
                            uptimeVal >= 99
                              ? 'text-emerald-500'
                              : uptimeVal >= 95
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {uptimeVal}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${Math.max(0, Math.min(100, uptimeVal))}%` }}
                            className={`h-full ${barColor}`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-300">
                      <span className={dev.incidentsCount > 0 ? 'text-rose-500 font-bold' : ''}>
                        {dev.incidentsCount} ({dev.totalDowntimeFormatted})
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-300">
                      {dev.avgLatency !== 'N/A' && dev.avgLatency !== null ? `${dev.avgLatency}ms` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}
                      >
                        {dev.currentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {String(selectedDeviceId) === String(dev.id) ? (
                        <button
                          onClick={() => onSelectDevice && onSelectDevice('all')}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          All Devices
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectDevice && onSelectDevice(String(dev.id))}
                          className="text-xs text-emerald-500 hover:text-emerald-600 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          Device Report <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="py-8 text-center text-xs text-slate-400">
                  No devices match the active search or status filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
