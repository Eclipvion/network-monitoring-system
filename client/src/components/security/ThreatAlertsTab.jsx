import React from 'react';
import {
  AlertTriangle,
  Zap,
  Eye,
  Info,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export default function ThreatAlertsTab({
  threatAlerts = [],
  handleOpenRemediationModal,
  openVulnerabilityModal,
  handleResolveThreat
}) {
  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Active Security Threat Incidents ({threatAlerts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Discovered via continuous port exposure audits, ARP guard, honeypot traps, and DNS anomaly telemetry
          </p>
        </div>

        {threatAlerts.length > 0 && (
          <button
            onClick={() => handleOpenRemediationModal('powershell')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-200" />
            <span>Generate Unified Firewall Fix</span>
          </button>
        )}
      </div>

      {/* Incident Cards */}
      <div className="space-y-3">
        {threatAlerts.map((threat) => (
          <div
            key={threat.id}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/30 shadow-sm space-y-3 transition-all hover:border-rose-500/50"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {threat.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Target: <strong className="text-slate-700 dark:text-slate-200">{threat.deviceName || threat.deviceIp}</strong> ({threat.deviceIp})
                    {threat.port && ` • Port ${threat.port}`}
                    {threat.service && ` (${threat.service})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-rose-500 text-white font-bold text-[10px] uppercase font-mono">
                  {threat.severity}
                </span>

                <button
                  onClick={() => openVulnerabilityModal(threat)}
                  className="px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Inspect target device, CVE, and copy firewall rules"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect & Fix</span>
                </button>

                <button
                  onClick={() => handleResolveThreat(threat.id)}
                  className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Resolve
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {threat.description}
            </p>

            <div
              onClick={() => openVulnerabilityModal(threat)}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1 cursor-pointer transition-all group"
              title="Click to view device info and copyable firewall rules"
            >
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 dark:text-white flex items-center gap-1 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-blue-500" /> Recommended Action:
                </strong>
                <span className="text-[11px] text-rose-500 font-semibold group-hover:underline flex items-center gap-0.5">
                  Generate Firewall Rule <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {threat.recommendation}
              </p>
            </div>
          </div>
        ))}

        {threatAlerts.length === 0 && (
          <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              All Systems Fully Secured
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              No active critical exploit port vulnerabilities, rogue hosts, or suspicious malware C2 domain lookups detected across your network.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
