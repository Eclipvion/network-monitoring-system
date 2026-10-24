import React from 'react';
import { History, ArrowDown, ArrowUp, Activity, Radio, Clock } from 'lucide-react';

export default function SpeedTestHistoryList({ history = [] }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-xs">
        <Clock className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
        No previous speed tests recorded yet. Click "Run Live Benchmark" above!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
        <History className="w-3.5 h-3.5 text-slate-500" />
        Past Speed Benchmarks ({history.length})
      </div>

      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80">
        {history.map((item, idx) => {
          const date = new Date(item.timestamp);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

          return (
            <div
              key={item.id || idx}
              className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              {/* Timestamp */}
              <div className="flex items-center gap-2 min-w-[110px]">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-300">{timeStr}</div>
                  <div className="text-[10px] text-slate-400">{dateStr}</div>
                </div>
              </div>

              {/* Download */}
              <div className="flex items-center gap-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                <ArrowDown className="w-3 h-3 text-emerald-500" />
                {item.downloadMbps.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">Mbps</span>
              </div>

              {/* Upload */}
              <div className="flex items-center gap-1 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                <ArrowUp className="w-3 h-3 text-cyan-500" />
                {item.uploadMbps.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">Mbps</span>
              </div>

              {/* Ping / Jitter */}
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-0.5">
                  <Activity className="w-3 h-3 text-indigo-400" />
                  {item.pingMs}ms
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="flex items-center gap-0.5">
                  <Radio className="w-3 h-3 text-purple-400" />
                  ±{item.jitterMs}ms
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
