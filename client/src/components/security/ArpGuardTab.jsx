import React, { useState, useMemo } from 'react';
import {
  Network,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  Copy,
  Radio,
  ShieldAlert,
  Server
} from 'lucide-react';

export default function ArpGuardTab({
  arpData,
  arpLoading,
  isArpPoisoned,
  fetchArpGuard,
  handleCopyText
}) {
  const [arpSearch, setArpSearch] = useState('');
  const [arpTypeFilter, setArpTypeFilter] = useState('ALL'); // 'ALL' | 'dynamic' | 'static'
  const [arpStatusFilter, setArpStatusFilter] = useState('ALL'); // 'ALL' | 'CLEAN' | 'CONFLICT'

  const filteredArpEntries = useMemo(() => {
    if (!arpData?.entries) return [];
    return arpData.entries.filter((entry) => {
      const q = arpSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        entry.ip.toLowerCase().includes(q) ||
        entry.mac.toLowerCase().includes(q) ||
        (entry.vendor && entry.vendor.toLowerCase().includes(q)) ||
        (entry.interfaceIp && entry.interfaceIp.toLowerCase().includes(q));

      const matchesType =
        arpTypeFilter === 'ALL' ||
        entry.type.toLowerCase() === arpTypeFilter.toLowerCase();

      const isSuspect = arpData.mitmSuspects?.some((s) => s.mac === entry.mac);
      const matchesStatus =
        arpStatusFilter === 'ALL' ||
        (arpStatusFilter === 'CONFLICT' && isSuspect) ||
        (arpStatusFilter === 'CLEAN' && !isSuspect);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [arpData, arpSearch, arpTypeFilter, arpStatusFilter]);

  return (
    <div className="space-y-4">
      {/* Top Banner: Real-time ARP Inspection & MITM Status */}
      <div className={`p-4 sm:p-5 rounded-2xl glass-panel border transition-all ${
        isArpPoisoned
          ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/20'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isArpPoisoned ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500/10 text-cyan-500'
            }`}>
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Layer-2 ARP Protocol Guard & Anti-MITM Inspection
                </h3>
                {isArpPoisoned ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono animate-pulse">
                    CRITICAL MITM DETECTED!
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 font-mono">
                    CLEAN • ZERO POISONING
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Continuously compares kernel ARP cache entries to identify IP-MAC collision attacks, router gateway spoofing, and rogue sniffing hosts.
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchArpGuard()}
            disabled={arpLoading}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${arpLoading ? 'animate-spin text-cyan-500' : ''}`} />
            <span>Rescan ARP</span>
          </button>
        </div>

        {/* MITM Attack Alert Details */}
        {isArpPoisoned && (
          <div className="mt-3.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs space-y-1 text-rose-600 dark:text-rose-300">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Suspect Hosts with Duplicate MAC Collisions Detected:</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {arpData.mitmSuspects.map((s, sIdx) => (
                <div key={sIdx} className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-rose-400 font-mono text-[11px] border border-rose-500/30">
                  MAC: <strong>{s.mac}</strong> ({s.ips?.join(', ')})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="p-3.5 sm:p-4 rounded-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search IP, MAC address, vendor, or adapter..."
            value={arpSearch}
            onChange={(e) => setArpSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={arpStatusFilter}
            onChange={(e) => setArpStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="CLEAN">Authentic Only</option>
            <option value="CONFLICT">Collisions / Suspects Only</option>
          </select>

          <select
            value={arpTypeFilter}
            onChange={(e) => setArpTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="dynamic">Dynamic DHCP</option>
            <option value="static">Static Entries</option>
          </select>
        </div>
      </div>

      {/* Responsive View: Desktop Table */}
      <div className="hidden sm:block rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Physical MAC Address</th>
                <th className="py-3 px-4">Hardware Manufacturer (OUI)</th>
                <th className="py-3 px-4">Allocation Type</th>
                <th className="py-3 px-4">Interface Adapter</th>
                <th className="py-3 px-4">Security Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {filteredArpEntries.map((entry, idx) => {
                const isGateway = entry.ip === arpData?.gateway?.ip;
                const isSuspect = arpData?.mitmSuspects?.some((s) => s.mac === entry.mac);

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isSuspect
                        ? 'bg-rose-500/10'
                        : isGateway
                          ? 'bg-cyan-500/5'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{entry.ip}</span>
                        {isGateway && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[9px] font-mono font-bold">
                            GATEWAY
                          </span>
                        )}
                        <button
                          onClick={() => handleCopyText(entry.ip)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy IP"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span>{entry.mac}</span>
                        <button
                          onClick={() => handleCopyText(entry.mac)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy MAC"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                        {entry.vendor}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        entry.type === 'dynamic'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {entry.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {entry.interfaceIp}
                    </td>

                    <td className="py-3 px-4">
                      {isSuspect ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          Duplicate Collision
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Authentic
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredArpEntries.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                    No ARP entries match the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive View: Mobile Cards (< sm) */}
      <div className="sm:hidden space-y-2.5">
        {filteredArpEntries.map((entry, idx) => {
          const isGateway = entry.ip === arpData?.gateway?.ip;
          const isSuspect = arpData?.mitmSuspects?.some((s) => s.mac === entry.mac);

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border space-y-2 text-xs shadow-xs ${
                isSuspect
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono font-bold text-slate-900 dark:text-white">
                  <span>{entry.ip}</span>
                  {isGateway && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[9px] font-bold">
                      GATEWAY
                    </span>
                  )}
                  <button onClick={() => handleCopyText(entry.ip)} className="text-slate-400">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {isSuspect ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Collision
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Authentic
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span>{entry.mac}</span>
                  <button onClick={() => handleCopyText(entry.mac)} className="text-slate-400">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <span className="uppercase text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800">
                  {entry.type}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800/60 text-slate-500">
                <span>Vendor: <strong className="text-slate-700 dark:text-slate-300">{entry.vendor}</strong></span>
                <span className="font-mono text-[10px]">{entry.interfaceIp}</span>
              </div>
            </div>
          );
        })}

        {filteredArpEntries.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            No ARP entries match the filter criteria.
          </div>
        )}
      </div>
    </div>
  );
}
