import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Clock,
  Wifi,
  ShieldAlert,
  Percent,
  TrendingUp,
  RefreshCw,
  Server
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import StatusBadge from './StatusBadge';
import api from '../services/api';

export default function DeviceDetailsModal({ isOpen, onClose, deviceId }) {
  const [deviceData, setDeviceData] = useState(null);
  const [history, setHistory] = useState([]);
  const [range, setRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDetails = async (selectedRange = range) => {
    if (!deviceId) return;
    try {
      setRefreshing(true);
      const [statusRes, historyRes] = await Promise.all([
        api.getDeviceStatus(deviceId),
        api.getDeviceHistory(deviceId, selectedRange)
      ]);
      setDeviceData(statusRes);
      setHistory(historyRes);
    } catch (err) {
      console.error('Failed to load device details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen && deviceId) {
      setLoading(true);
      fetchDetails(range);
    }
  }, [isOpen, deviceId, range]);

  if (!isOpen) return null;

  // Format chart data
  const chartData = history.map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullTime: new Date(item.timestamp).toLocaleString(),
    latency: item.latency !== null ? item.latency : 0,
    packetLoss: item.packetLoss || 0,
    status: item.status
  }));

  const device = deviceData?.device;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-emerald-500">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {device?.name || 'Device Details'}
                </h3>
                {deviceData && <StatusBadge status={deviceData.status} size="sm" />}
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {device?.ip} • {device?.type?.toUpperCase()} • Interval: {device?.interval}s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDetails(range)}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
              <p className="text-sm font-medium">Gathering telemetry & historical data...</p>
            </div>
          ) : (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span>Current Latency</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {deviceData?.latency !== null ? `${deviceData.latency} ms` : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    <Wifi className="w-4 h-4 text-cyan-500" />
                    <span>Packet Loss</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {deviceData?.packetLoss !== null ? `${deviceData.packetLoss}%` : '0%'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    <Percent className="w-4 h-4 text-violet-500" />
                    <span>Calculated Uptime</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {deviceData?.uptime ?? 100}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Last Check</span>
                  </div>
                  <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {deviceData?.lastCheck ? new Date(deviceData.lastCheck).toLocaleTimeString() : 'Pending'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {deviceData?.lastCheck ? new Date(deviceData.lastCheck).toLocaleDateString() : 'Awaiting engine'}
                  </div>
                </div>
              </div>

              {/* Latency History Graph */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Historical Latency Response
                    </h4>
                  </div>
                  {/* Range Selector */}
                  <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
                    {['1h', '24h', '7d'].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          range === r
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-64 w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No telemetry recorded yet in this time window.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                        <XAxis
                          dataKey="time"
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          unit="ms"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-xs text-white space-y-1">
                                  <div className="font-semibold text-slate-300">{data.fullTime}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 font-mono font-bold">Latency:</span>
                                    <span>{data.latency} ms</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono">Packet Loss:</span>
                                    <span>{data.packetLoss}%</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400">Status:</span>
                                    <span className="font-semibold">{data.status}</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="latency"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#latencyGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Status History List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Recent Check Log
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                  {history.slice(-15).reverse().map((entry, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={entry.status} size="sm" pulse={false} />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {entry.message || `Status check completed`}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 font-mono">
                        {entry.latency !== null && (
                          <span>{entry.latency} ms</span>
                        )}
                        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No status events recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
