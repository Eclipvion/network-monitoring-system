import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Terminal
} from 'lucide-react';

export default function PortCatalogTab({
  portsCatalog = [],
  openVulnerabilityModal
}) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');

  const filteredPorts = useMemo(() => {
    return portsCatalog.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(p.port).includes(q) ||
        (p.service && p.service.toLowerCase().includes(q)) ||
        (p.cve && p.cve.toLowerCase().includes(q)) ||
        (p.attackType && p.attackType.toLowerCase().includes(q));

      const matchesRisk = riskFilter === 'ALL' || p.risk === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [portsCatalog, search, riskFilter]);

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Attack Surface Reference Database ({portsCatalog.length} Vector Profiles)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Technical encyclopedia of monitored exploit ports, CVE mappings, and perimeter mitigation policies
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search port or CVE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredPorts.map((item) => {
          const isCrit = item.risk === 'CRITICAL';
          const isHigh = item.risk === 'HIGH';

          return (
            <div
              key={item.port}
              onClick={() => openVulnerabilityModal(item)}
              className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 shadow-sm space-y-3 cursor-pointer transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      Port {item.port}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.service}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    {item.attackType}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    isCrit
                      ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                      : isHigh
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        : 'bg-blue-500/15 text-blue-500 border border-blue-500/30'
                  }`}
                >
                  {item.risk} RISK
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-semibold text-rose-500 block text-[11px]">
                  Known Exploit: {item.exploitTarget}
                </span>
                <p className="text-slate-500 dark:text-slate-400 line-clamp-2 text-[11px] leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
                <span>View CVE & Hardening Policy</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}

        {filteredPorts.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            No exploit vectors match the filter criteria.
          </div>
        )}
      </div>
    </div>
  );
}
