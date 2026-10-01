import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Server,
  Filter,
  Check,
  RefreshCw
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function AlertsPage({ alerts = [], onResolveAlert, loading, onRefresh }) {
  const [filter, setFilter] = useState('ACTIVE'); // 'ACTIVE', 'RESOLVED', 'ALL'
  const [resolvingId, setResolvingId] = useState(null);

  const activeAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  const displayAlerts = alerts.filter(a => {
    if (filter === 'ACTIVE') return !a.resolved;
    if (filter === 'RESOLVED') return a.resolved;
    return true;
  });

  const handleResolve = async (id) => {
    try {
      setResolvingId(id);
      await onResolveAlert(id);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Incidents
            </p>
            <h3 className="text-3xl font-extrabold text-rose-500 mt-1">
              {activeAlerts.length}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Requires immediate administrator attention
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Resolved Incidents
            </p>
            <h3 className="text-3xl font-extrabold text-emerald-500 mt-1">
              {resolvedAlerts.length}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Recovered automatically or resolved manually
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Recorded Alerts
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {alerts.length}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cumulative historical alert events
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'ACTIVE'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active ({activeAlerts.length})
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'RESOLVED'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Resolved ({resolvedAlerts.length})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Events ({alerts.length})
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh alerts"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
        </button>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {displayAlerts.map((alert) => {
          const device = alert.device || {};
          const isResolved = alert.resolved;

          return (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl glass-panel border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isResolved
                  ? 'border-slate-200 dark:border-slate-800 opacity-80'
                  : 'border-rose-500/30 bg-rose-500/5'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
                  isResolved
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-500'
                    : 'bg-rose-500/10 text-rose-500 animate-pulse'
                }`}>
                  {isResolved ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {device.name || alert.deviceName || `Device #${alert.deviceId}`}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      ({device.ip || alert.deviceIp || 'No IP'})
                    </span>
                    <StatusBadge status={alert.type || 'DOWN'} size="sm" pulse={!isResolved} />
                    {isResolved && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Resolved
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {alert.message || 'Host ping failed consecutive retry threshold.'}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Triggered: {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    {alert.resolvedAt && (
                      <span className="text-emerald-500">
                        Resolved: {new Date(alert.resolvedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isResolved && (
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolvingId === alert.id}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 self-end sm:self-center disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {resolvingId === alert.id ? 'Resolving...' : 'Mark Resolved'}
                </button>
              )}
            </div>
          );
        })}

        {displayAlerts.length === 0 && (
          <div className="p-12 text-center rounded-2xl glass-panel text-slate-400 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
            No {filter.toLowerCase()} alerts found. Systems are running smoothly.
          </div>
        )}
      </div>
    </div>
  );
}
