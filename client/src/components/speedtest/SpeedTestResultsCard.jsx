import React from 'react';
import { ArrowDown, ArrowUp, Activity, Radio, Globe, Award, ShieldCheck } from 'lucide-react';

export default function SpeedTestResultsCard({ result }) {
  if (!result) return null;

  const {
    downloadMbps = 0,
    uploadMbps = 0,
    pingMs = 0,
    jitterMs = 0,
    serverLocation = 'Edge Anycast CDN',
    timestamp
  } = result;

  const getQualityBadge = () => {
    if (downloadMbps >= 200 && pingMs <= 40) {
      return { label: 'Ultra Gigabit (Tier 1)', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
    }
    if (downloadMbps >= 50 && pingMs <= 80) {
      return { label: 'High-Speed Broadband', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' };
    }
    return { label: 'Standard Connectivity', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
  };

  const badge = getQualityBadge();

  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 p-4 space-y-3">
      {/* Header Quality & Server */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {serverLocation}
          </span>
          {timestamp && (
            <span className="text-[11px] text-slate-400">
              • {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${badge.color}`}>
          <Award className="w-3 h-3" />
          {badge.label}
        </span>
      </div>

      {/* Metrics 4-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Download */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 uppercase">
            <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
            Download
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {downloadMbps.toFixed(1)}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Mbps</span>
          </div>
        </div>

        {/* Upload */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 uppercase">
            <ArrowUp className="w-3.5 h-3.5 text-cyan-500" />
            Upload
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {uploadMbps.toFixed(1)}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Mbps</span>
          </div>
        </div>

        {/* Ping Latency */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 uppercase">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            Ping Latency
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
              {pingMs}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">ms</span>
          </div>
        </div>

        {/* Jitter */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 uppercase">
            <Radio className="w-3.5 h-3.5 text-purple-500" />
            Jitter Variance
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
              ±{jitterMs}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
