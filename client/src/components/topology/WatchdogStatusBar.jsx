import React, { useState } from 'react';
import {
  Radio,
  Zap,
  RefreshCw,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
  Smartphone,
  Laptop
} from 'lucide-react';
import api from '../../services/api';

export default function WatchdogStatusBar({
  watchdogStatus,
  onRefreshTopology,
  onWatchdogUpdated
}) {
  const [triggering, setTriggering] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [togglingAutoAdd, setTogglingAutoAdd] = useState(false);

  const isRunning = watchdogStatus?.isRunning ?? true;
  const autoAddEnabled = watchdogStatus?.autoAddEnabled ?? true;
  const activeCount = watchdogStatus?.activeConnectedCount ?? 0;
  const intervalSec = watchdogStatus?.intervalSeconds ?? 60;
  const recentEvents = watchdogStatus?.recentEvents || [];
  const latestEvent = recentEvents[0] || null;

  const handleManualSweep = async () => {
    setTriggering(true);
    try {
      const res = await api.triggerWatchdogSweep();
      if (onWatchdogUpdated) onWatchdogUpdated(res.status);
      if (onRefreshTopology) await onRefreshTopology();
    } catch (e) {
      console.error('Trigger sweep failed:', e);
    } finally {
      setTriggering(false);
    }
  };

  const handleToggleAutoAdd = async () => {
    setTogglingAutoAdd(true);
    try {
      const res = await api.setWatchdogConfig({ enabled: !autoAddEnabled });
      if (onWatchdogUpdated) onWatchdogUpdated(res.config);
    } catch (e) {
      console.error('Toggle auto-add failed:', e);
    } finally {
      setTogglingAutoAdd(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-xs shadow-md space-y-3">
      {/* Main Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Watchdog Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 animate-pulse text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100">Live Network Watchdog</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {isRunning ? `Every ${intervalSec}s` : 'Paused'}
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                • {activeCount} Live Hosts on Wi-Fi
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auto-adds new devices to Topology & Monitoring • Auto-removes disconnected hosts from map
            </p>
          </div>
        </div>

        {/* Action Controls & Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-Add Toggle */}
          <button
            onClick={handleToggleAutoAdd}
            disabled={togglingAutoAdd}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              autoAddEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="When active, new devices joining your Wi-Fi are automatically added"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auto-Add: {autoAddEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Trigger Sweep Button */}
          <button
            onClick={handleManualSweep}
            disabled={triggering}
            className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition-all disabled:opacity-50"
            title="Scan Wi-Fi for newly joined or disconnected devices right now"
          >
            <Zap className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
            <span>{triggering ? 'Scanning...' : 'Scan Now'}</span>
          </button>

          {/* Event History Toggle */}
          {recentEvents.length > 0 && (
            <button
              onClick={() => setShowEventLog(!showEventLog)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
              title="Toggle Live Event Log"
            >
              {showEventLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Latest Live Event Ticker */}
      {latestEvent && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px]">
          <div className="flex items-center gap-2 truncate mr-2">
            {latestEvent.type === 'JOINED' ? (
              <span className="flex items-center gap-1 font-bold text-emerald-400 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Joined Network:
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-slate-400 shrink-0">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Disconnected:
              </span>
            )}
            <span className="font-semibold text-slate-200 truncate">{latestEvent.name}</span>
            <span className="font-mono text-slate-400">({latestEvent.ip})</span>
          </div>

          <span className="text-slate-400 text-[10px] shrink-0">
            {new Date(latestEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {/* Expandable Historical Log Drawer */}
      {showEventLog && recentEvents.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 max-h-48 overflow-y-auto animate-in fade-in duration-150">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span>Watchdog Event Audit Log</span>
            <span>Last {recentEvents.length} Events</span>
          </div>

          <div className="space-y-1.5">
            {recentEvents.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2 truncate mr-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      ev.type === 'JOINED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {ev.type}
                  </span>
                  <span className="font-semibold text-slate-200 truncate">{ev.name}</span>
                  <span className="font-mono text-slate-400">[{ev.ip}]</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
