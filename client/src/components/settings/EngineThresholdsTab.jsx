import React from 'react';
import { Sliders, Activity, Zap, ShieldAlert, Clock, Gauge } from 'lucide-react';

export default function EngineThresholdsTab({ settings, onChange }) {
  const intervals = [5, 10, 15, 30, 60];
  const jitterPresets = [
    { label: 'Strict VoIP (< 15ms)', val: 15 },
    { label: 'Standard (< 35ms)', val: 35 },
    { label: 'Tolerant (< 60ms)', val: 60 }
  ];

  return (
    <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-500" />
            Monitoring Engine Cadence & Threshold Rules
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global heartbeat intervals, anti-flapping filters, and PRTG-grade warning triggers for network latency and jitter.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
          <Zap className="w-3.5 h-3.5" />
          Multi-Layer Engine
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Default Interval */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              Default Polling Cadence
            </label>
            <span className="font-mono text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
              {settings.defaultInterval}s
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={settings.defaultInterval}
              onChange={(e) => onChange('defaultInterval', Number(e.target.value))}
              className="flex-1 accent-emerald-500 cursor-pointer"
            />
            <input
              type="number"
              min="5"
              max="3600"
              value={settings.defaultInterval}
              onChange={(e) => onChange('defaultInterval', Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {intervals.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange('defaultInterval', val)}
                className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-all ${
                  settings.defaultInterval === val
                    ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-emerald-500'
                }`}
              >
                {val}s
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Cadence for all nodes without custom per-device override intervals.
          </p>
        </div>

        {/* Anti-Flapping Retry Count */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-500" />
              Anti-Flapping Retry Count
            </label>
            <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
              {settings.retryCountBeforeDown} retries
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              value={settings.retryCountBeforeDown}
              onChange={(e) => onChange('retryCountBeforeDown', Number(e.target.value))}
              className="flex-1 accent-blue-500 cursor-pointer"
            />
            <input
              type="number"
              min="1"
              max="10"
              value={settings.retryCountBeforeDown}
              onChange={(e) => onChange('retryCountBeforeDown', Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Consecutive missed pings required before marking a node DOWN to filter transient jitter.
          </p>
        </div>

        {/* Latency Warning Threshold */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-500" />
              Latency Warning Limit
            </label>
            <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              {settings.latencyWarningThresholdMs} ms
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="20"
              max="1000"
              step="10"
              value={settings.latencyWarningThresholdMs}
              onChange={(e) => onChange('latencyWarningThresholdMs', Number(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
            <input
              type="number"
              min="5"
              max="5000"
              value={settings.latencyWarningThresholdMs}
              onChange={(e) => onChange('latencyWarningThresholdMs', Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Round-trip response time exceeding this limit triggers a WARNING status.
          </p>
        </div>

        {/* Packet Loss Threshold */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-500" />
              Packet Loss Warning Limit
            </label>
            <span className="font-mono text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
              {settings.packetLossWarningPercent}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={settings.packetLossWarningPercent}
              onChange={(e) => onChange('packetLossWarningPercent', Number(e.target.value))}
              className="flex-1 accent-rose-500 cursor-pointer"
            />
            <input
              type="number"
              min="1"
              max="100"
              value={settings.packetLossWarningPercent}
              onChange={(e) => onChange('packetLossWarningPercent', Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Percentage of dropped packets within a probe sample that flags a WARNING.
          </p>
        </div>

        {/* RFC 3550 Jitter Alert Threshold */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 sm:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                RFC 3550 Jitter Sensitivity (QoS / VoIP)
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-mono">
                PRTG Standard
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded">
              ±{settings.jitterWarningThresholdMs || 35} ms
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <input
              type="number"
              min="2"
              max="500"
              step="0.5"
              value={settings.jitterWarningThresholdMs || 35}
              onChange={(e) => onChange('jitterWarningThresholdMs', Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />

            <div className="flex items-center gap-2">
              {jitterPresets.map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => onChange('jitterWarningThresholdMs', preset.val)}
                  className={`text-xs px-3 py-2 rounded-xl border transition-all ${
                    settings.jitterWarningThresholdMs === preset.val
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 font-bold shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-cyan-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Flags VoIP degradation and audio jitter when latency variation across consecutive probes exceeds this threshold.
          </p>
        </div>
      </div>
    </div>
  );
}
