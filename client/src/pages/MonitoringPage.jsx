import React from 'react';
import {
  Activity,
  Radio,
  Wifi,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function MonitoringPage({
  devices = [],
  liveEvents = [],
  onOpenDetails
}) {
  const upCount = devices.filter(d => d.status === 'UP').length;
  const downCount = devices.filter(d => d.status === 'DOWN').length;
  const warnCount = devices.filter(d => d.status === 'WARNING').length;
  const total = devices.length;

  const upPct = total > 0 ? Math.round((upCount / total) * 100) : 0;
  const downPct = total > 0 ? Math.round((downCount / total) * 100) : 0;
  const warnPct = total > 0 ? Math.round((warnCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Live Health Header Bar */}
      <div className="p-5 rounded-2xl glass-panel space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              PRTG Sensor Array Live Status
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-emerald-500 font-bold">{upCount} UP ({upPct}%)</span>
            <span className="text-amber-500 font-bold">{warnCount} WARNING ({warnPct}%)</span>
            <span className="text-rose-500 font-bold">{downCount} DOWN ({downPct}%)</span>
          </div>
        </div>

        {/* Multi-colored Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          <div style={{ width: `${upPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`UP: ${upPct}%`} />
          <div style={{ width: `${warnPct}%` }} className="bg-amber-500 transition-all duration-300" title={`WARNING: ${warnPct}%`} />
          <div style={{ width: `${downPct}%` }} className="bg-rose-500 transition-all duration-300" title={`DOWN: ${downPct}%`} />
        </div>
      </div>

      {/* Main Grid: Sensor Matrix & Live Socket Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sensor Matrix Tiles */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Live Probing Sensor Tiles
              </h4>
            </div>
            <span className="text-xs text-slate-400">
              Auto-updating via WebSocket
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {devices.map((device) => {
              const latest = device.latestResult;
              const isUp = device.status === 'UP';
              const isDown = device.status === 'DOWN';
              const isWarning = device.status === 'WARNING';

              let borderColor = 'border-slate-200 dark:border-slate-800';
              let badgeColor = 'text-slate-400';
              if (isUp) {
                borderColor = 'border-emerald-500/40 shadow-sm shadow-emerald-500/5';
                badgeColor = 'text-emerald-500';
              } else if (isDown) {
                borderColor = 'border-rose-500/50 shadow-sm shadow-rose-500/10';
                badgeColor = 'text-rose-500';
              } else if (isWarning) {
                borderColor = 'border-amber-500/50 shadow-sm shadow-amber-500/10';
                badgeColor = 'text-amber-500';
              }

              return (
                <div
                  key={device.id}
                  onClick={() => onOpenDetails(device.id)}
                  className={`p-5 rounded-2xl glass-panel card-hover border ${borderColor} cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden`}
                >
                  {/* Subtle corner indicator line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-slate-500'
                  }`} />

                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {device.name}
                      </h4>
                      <p className="font-mono text-xs text-slate-400">
                        {device.ip}
                      </p>
                    </div>
                    <StatusBadge status={device.status} size="sm" />
                  </div>

                  {/* Latency & Packet Loss Display */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Response Time
                      </span>
                      <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                        {latest && latest.latency !== null ? `${latest.latency} ms` : '—'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Packet Loss
                      </span>
                      <span className={`text-base font-bold font-mono ${latest?.packetLoss > 0 ? 'text-amber-500' : 'text-slate-500'}`}>
                        {latest && latest.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {latest?.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : 'Awaiting check'}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                      Inspect <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Live Socket Stream Ticker */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Live Telemetry Feed
              </h4>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">
              WebSocket
            </span>
          </div>

          <div className="p-4 rounded-2xl glass-panel space-y-3">
            <p className="text-xs text-slate-400">
              Live broadcast events from Node.js & Python monitoring engine:
            </p>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {liveEvents.map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs space-y-1 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={evt.status} size="sm" pulse={false} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                        {evt.name || `Device #${evt.deviceId}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>{evt.ip || '—'}</span>
                    <span>
                      {evt.latency !== null && evt.latency !== undefined ? `${evt.latency}ms` : ''}
                      {evt.packetLoss !== undefined ? ` • ${evt.packetLoss}% loss` : ''}
                    </span>
                  </div>

                  {evt.message && (
                    <p className="text-[11px] text-slate-400 italic truncate">
                      {evt.message}
                    </p>
                  )}
                </div>
              ))}

              {liveEvents.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400">
                  Waiting for incoming telemetry packets...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
