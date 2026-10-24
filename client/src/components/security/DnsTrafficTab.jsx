import React, { useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy
} from 'lucide-react';

export default function DnsTrafficTab({
  dnsTraffic = [],
  dnsSearch,
  setDnsSearch,
  dnsCategoryFilter,
  setDnsCategoryFilter,
  dnsThreatFilter,
  setDnsThreatFilter,
  isHarvestingDns,
  handleHarvestDns,
  handleClearDns,
  handleCopyText
}) {
  const dnsCategories = useMemo(() => {
    return Array.from(new Set(dnsTraffic.map((t) => t.category))).filter(Boolean);
  }, [dnsTraffic]);

  const filteredDns = useMemo(() => {
    return dnsTraffic.filter((item) => {
      const q = dnsSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.domain.toLowerCase().includes(q) ||
        (item.clientIp && item.clientIp.toLowerCase().includes(q));

      const matchesCat = dnsCategoryFilter === 'ALL' || item.category === dnsCategoryFilter;
      const matchesThreat = dnsThreatFilter === 'ALL' || item.threatLevel === dnsThreatFilter;

      return matchesSearch && matchesCat && matchesThreat;
    });
  }, [dnsTraffic, dnsSearch, dnsCategoryFilter, dnsThreatFilter]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter domain, site, or client IP..."
              value={dnsSearch}
              onChange={(e) => setDnsSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dnsCategoryFilter}
              onChange={(e) => setDnsCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {dnsCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={dnsThreatFilter}
              onChange={(e) => setDnsThreatFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Threats</option>
              <option value="SAFE">Safe Only</option>
              <option value="SUSPICIOUS">Suspicious Only</option>
              <option value="MALICIOUS">Malicious Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={handleHarvestDns}
            disabled={isHarvestingDns}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            title="Harvest real-time Windows DNS resolver cache"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isHarvestingDns ? 'animate-spin' : ''}`} />
            <span>Harvest DNS</span>
          </button>

          {dnsTraffic.length > 0 && (
            <button
              onClick={handleClearDns}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
              title="Clear traffic history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Responsive View: Desktop Table */}
      <div className="hidden sm:block rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4">Domain / Web Destination</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Threat Level</th>
                <th className="py-3 px-4">SOC Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {filteredDns.map((item) => {
                const isMalicious = item.threatLevel === 'MALICIOUS';
                const isSuspicious = item.threatLevel === 'SUSPICIOUS';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isMalicious
                        ? 'bg-rose-500/10'
                        : isSuspicious
                          ? 'bg-amber-500/5'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 font-medium">
                      {item.clientIp}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {item.domain}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {item.queryType || 'A'}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isMalicious
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : isSuspicious
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isMalicious ? (
                          <XCircle className="w-3 h-3 text-rose-500" />
                        ) : isSuspicious ? (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        )}
                        {item.threatLevel}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {item.flagReason}
                    </td>
                  </tr>
                );
              })}

              {filteredDns.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
                    No web searches or DNS traffic recorded yet. Click "Harvest DNS" to capture real-time activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive View: Mobile Cards (< sm) */}
      <div className="sm:hidden space-y-2.5">
        {filteredDns.map((item) => {
          const isMalicious = item.threatLevel === 'MALICIOUS';
          const isSuspicious = item.threatLevel === 'SUSPICIOUS';

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border space-y-2 text-xs shadow-xs ${
                isMalicious
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : isSuspicious
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {item.domain}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isMalicious
                      ? 'bg-rose-500/20 text-rose-500'
                      : isSuspicious
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-emerald-500/20 text-emerald-500'
                  }`}
                >
                  {item.threatLevel}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Client: {item.clientIp}</span>
                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {item.category}
                </span>
                <span className="text-slate-500 italic text-[10px]">{item.flagReason}</span>
              </div>
            </div>
          );
        })}

        {filteredDns.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            No web searches or DNS traffic recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
