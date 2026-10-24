import React from 'react';
import { Layers, AlertTriangle } from 'lucide-react';

export default function ReportKpiGrid({ metrics = {}, compliance = {}, flappingDevices = [] }) {
  const targetSla = compliance.targetSlaPercent || 99.9;
  const uptime = metrics.uptimePercent ?? 100;

  return (
    <div className="space-y-4">
      {/* Flapping Host Warning Alert */}
      {flappingDevices.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-700 dark:text-amber-300">
              Network Link Flapping Detected ({flappingDevices.length} hosts unstable)
            </span>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Recurring outage cycles (&gt;= 3 incidents) were recorded during this period:{' '}
              <span className="font-semibold text-amber-800 dark:text-amber-200">
                {flappingDevices.map((d) => `${d.name} (${d.ip}) [${d.incidentsCount} incidents]`).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Availability Uptime */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Availability Uptime
          </span>
          <div
            className={`text-2xl font-bold font-mono ${
              uptime >= targetSla
                ? 'text-emerald-500'
                : uptime >= 95
                ? 'text-amber-500'
                : 'text-rose-500'
            }`}
          >
            {metrics.uptimePercent !== undefined ? `${metrics.uptimePercent}%` : '—'}
          </div>
          <p className="text-[10px] text-slate-400">Target SLA: {targetSla}%</p>
        </div>

        {/* Downtime Incidents */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Downtime Incidents
          </span>
          <div
            className={`text-2xl font-bold font-mono ${
              (metrics.totalIncidents || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'
            }`}
          >
            {metrics.totalIncidents ?? 0}
          </div>
          <p className="text-[10px] text-slate-400">
            {metrics.totalIncidents === 0 ? 'Zero Outages' : 'Recorded Outages'}
          </p>
        </div>

        {/* Total Outage Duration */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Outage Duration
          </span>
          <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100 truncate">
            {metrics.totalDowntimeFormatted || '0s'}
          </div>
          <p className="text-[10px] text-slate-400">Cumulative Down Time</p>
        </div>

        {/* MTTR */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Avg MTTR (Recovery)
          </span>
          <div className="text-xl font-bold font-mono text-blue-500 truncate">
            {metrics.mttrFormatted || '0s'}
          </div>
          <p className="text-[10px] text-slate-400">Mean Time to Restore</p>
        </div>

        {/* Avg Latency */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Avg Latency
          </span>
          <div className="text-2xl font-bold font-mono text-indigo-500">
            {metrics.avgLatency !== null && metrics.avgLatency !== undefined ? `${metrics.avgLatency}ms` : '—'}
          </div>
          <p className="text-[10px] text-slate-400 font-mono truncate">
            Min: {metrics.minLatency ?? '—'} / Max: {metrics.maxLatency ?? '—'}ms
          </p>
        </div>

        {/* Probes Evaluated */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Probes Evaluated
          </span>
          <div className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-200">
            {metrics.totalChecks?.toLocaleString() || 0}
          </div>
          <p className="text-[10px] text-slate-400">
            Avg Loss: {metrics.avgPacketLoss || 0}%
          </p>
        </div>
      </div>

      {/* Availability Status Distribution Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h4 className="font-bold text-slate-900 dark:text-white">
              Availability Probing Distribution
            </h4>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="text-emerald-500 font-bold">
              UP: {metrics.pureUptimePercent ?? metrics.uptimePercent}% ({metrics.upChecks || 0})
            </span>
            <span className="text-amber-500 font-bold">
              WARNING: {metrics.warningPercent || 0}% ({metrics.warningChecks || 0})
            </span>
            <span className="text-rose-500 font-bold">
              DOWN: {metrics.downtimePercent || 0}% ({metrics.downChecks || 0})
            </span>
          </div>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          <div
            style={{ width: `${metrics.pureUptimePercent ?? metrics.uptimePercent ?? 100}%` }}
            className="bg-emerald-500 transition-all duration-300"
            title={`UP: ${metrics.pureUptimePercent}%`}
          />
          <div
            style={{ width: `${metrics.warningPercent || 0}%` }}
            className="bg-amber-500 transition-all duration-300"
            title={`WARNING: ${metrics.warningPercent}%`}
          />
          <div
            style={{ width: `${metrics.downtimePercent || 0}%` }}
            className="bg-rose-500 transition-all duration-300"
            title={`DOWN: ${metrics.downtimePercent}%`}
          />
        </div>
      </div>
    </div>
  );
}
