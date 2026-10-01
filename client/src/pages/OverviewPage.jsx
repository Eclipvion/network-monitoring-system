import React from 'react';
import {
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Plus
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function OverviewPage({
  summary,
  onOpenDeviceDetails,
  onOpenAddDevice,
  onNavigateTab
}) {
  const {
    totalDevices = 0,
    upCount = 0,
    downCount = 0,
    warningCount = 0,
    pausedCount = 0,
    avgLatency = 0,
    activeAlertCount = 0,
    devices = [],
    recentAlerts = []
  } = summary || {};

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <div className="p-5 rounded-2xl glass-panel card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Monitored
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {totalDevices}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {pausedCount > 0 ? `${pausedCount} paused` : 'All actively scanned'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Server className="w-6 h-6" />
          </div>
        </div>

        {/* Up / Operational */}
        <div className="p-5 rounded-2xl glass-panel card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Healthy (UP)
            </p>
            <h3 className="text-3xl font-extrabold text-emerald-500 mt-1">
              {upCount}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {totalDevices > 0 ? `${Math.round((upCount / totalDevices) * 100)}% operational` : 'No hosts'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Down / Warning */}
        <div className="p-5 rounded-2xl glass-panel card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Incidents / Down
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-extrabold text-rose-500">
                {downCount}
              </h3>
              {warningCount > 0 && (
                <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  +{warningCount} Warn
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {downCount === 0 ? 'Zero active outages' : 'Attention required!'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Network Latency */}
        <div className="p-5 rounded-2xl glass-panel card-hover flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg Roundtrip
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
              {avgLatency} <span className="text-sm font-normal text-slate-400">ms</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {activeAlertCount} active system alert{activeAlertCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Active Alerts Banner if any */}
      {recentAlerts && recentAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-slate-900 dark:text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400">
                Active Critical Outages Detected ({recentAlerts.length})
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {recentAlerts.map(a => `${a.deviceName || 'Device'} (${a.deviceIp || a.deviceId})`).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('alerts')}
            className="px-4 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-sm"
          >
            Review Alerts
          </button>
        </div>
      )}

      {/* Main Grid: Device Health Grid & Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monitored Infrastructure */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Monitored Devices
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigateTab('devices')}
                className="text-xs font-semibold text-emerald-500 hover:text-emerald-600 flex items-center gap-1"
              >
                View all devices <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenAddDevice}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Device
              </button>
            </div>
          </div>

          <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Loss</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                  {devices.map((device) => {
                    const latest = device.latestResult;
                    return (
                      <tr
                        key={device.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => onOpenDeviceDetails(device.id)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {device.name}
                          </div>
                          <div className="font-mono text-slate-400 text-[11px]">
                            {device.ip}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                            {device.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={device.status} size="sm" />
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">
                          {latest && latest.latency !== null ? `${latest.latency} ms` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {latest && latest.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onOpenDeviceDetails(device.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            title="Inspect telemetry"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {devices.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                        No devices configured yet. Click "Add Device" to start monitoring.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Sensor Tiles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Sensor Health Grid
            </h3>
            <button
              onClick={() => onNavigateTab('monitoring')}
              className="text-xs font-semibold text-emerald-500 hover:text-emerald-600"
            >
              Sensor Grid
            </button>
          </div>

          <div className="p-4 rounded-2xl glass-panel space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time health matrix of all active probes:
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {devices.map((d) => {
                let border = 'border-slate-200 dark:border-slate-800';
                let bg = 'bg-slate-50 dark:bg-slate-800/40';
                if (d.status === 'UP') {
                  border = 'border-emerald-500/30';
                  bg = 'bg-emerald-500/5 hover:bg-emerald-500/10';
                } else if (d.status === 'DOWN') {
                  border = 'border-rose-500/40';
                  bg = 'bg-rose-500/10 hover:bg-rose-500/20';
                } else if (d.status === 'WARNING') {
                  border = 'border-amber-500/30';
                  bg = 'bg-amber-500/5 hover:bg-amber-500/10';
                }

                return (
                  <div
                    key={d.id}
                    onClick={() => onOpenDeviceDetails(d.id)}
                    className={`p-3 rounded-xl border ${border} ${bg} cursor-pointer transition-all duration-150 flex flex-col justify-between`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {d.name}
                      </span>
                      <StatusBadge status={d.status} size="sm" pulse={false} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>{d.ip}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {d.latestResult?.latency !== null && d.latestResult?.latency !== undefined
                          ? `${d.latestResult.latency}ms`
                          : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
