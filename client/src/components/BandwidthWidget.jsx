import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Zap,
  HardDrive,
  Gauge,
  Wifi,
  Radio,
  Layers,
  ChevronDown,
  ChevronUp,
  Maximize2
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
import api from '../services/api';
import { getSocket } from '../services/socket';
import LiveSpeedMeterModal from './speedtest/LiveSpeedMeterModal';

export default function BandwidthWidget({ variant = 'full' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiveWs, setIsLiveWs] = useState(false);
  const [isExpanded, setIsExpanded] = useState(variant === 'full');
  const [showSpeedModal, setShowSpeedModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial HTTP poll to get immediate data without waiting for next stream
    const fetchInitial = async () => {
      try {
        const res = await api.getBandwidthTelemetry();
        if (isMounted && res) {
          setData(res);
          setLoading(false);
        }
      } catch (e) {
        // Silent catch
      }
    };
    fetchInitial();

    // 2. Real-Time WebSocket Streaming (Option 2: 1-second instant push)
    let socket = null;
    try {
      socket = getSocket();
      if (socket) {
        if (socket.connected) setIsLiveWs(true);

        const onConnect = () => isMounted && setIsLiveWs(true);
        const onDisconnect = () => isMounted && setIsLiveWs(false);

        const handleBandwidthTelemetry = (payload) => {
          if (!isMounted || !payload) return;
          setData(payload);
          setLoading(false);
          setIsLiveWs(true);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('telemetry:bandwidth', handleBandwidthTelemetry);

        // Fallback safety interval: poll every 3s if socket drops connection
        const fallbackInterval = setInterval(() => {
          if (!socket.connected) {
            fetchInitial();
          }
        }, 3000);

        return () => {
          isMounted = false;
          clearInterval(fallbackInterval);
          socket.off('connect', onConnect);
          socket.off('disconnect', onDisconnect);
          socket.off('telemetry:bandwidth', handleBandwidthTelemetry);
        };
      }
    } catch (err) {
      console.warn('Socket telemetry setup fallback to polling:', err);
    }

    // Fallback standard HTTP polling if no socket
    const pollInterval = setInterval(fetchInitial, 2000);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  const current = data?.current || {
    downloadKbps: 0,
    uploadKbps: 0,
    downloadMbps: 0,
    uploadMbps: 0,
    totalRxMb: 0,
    totalTxMb: 0,
    peakDownloadKbps: 0,
    peakUploadKbps: 0
  };

  const history = data?.history || [];

  // Determine network saturation status
  const currentTotalKbps = current.downloadKbps + current.uploadKbps;
  let loadStatus = 'Optimal (Low Load)';
  let loadColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  if (currentTotalKbps > 5000) {
    loadStatus = 'Heavy Network Load';
    loadColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  } else if (currentTotalKbps > 1000) {
    loadStatus = 'Moderate Activity';
    loadColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  }

  const formatSpeed = (kbps) => {
    if (!kbps || kbps === 0) return '0 KB/s';
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(2)} MB/s`;
    }
    return `${kbps.toFixed(1)} KB/s`;
  };

  // -------------------------------------------------------------
  // Compact / Ribbon Mode (for MonitoringPage)
  // -------------------------------------------------------------
  if (variant === 'ribbon') {
    return (
      <>
        <div className="rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-3.5 px-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-900/90">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-sm shadow-cyan-500/20">
              <Activity className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Live Bandwidth Telemetry
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isLiveWs 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                    : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                }`}>
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  {isLiveWs ? 'WebSocket 1s' : 'HTTP Sync'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Primary adapter speed & cumulative throughput
              </p>
            </div>
          </div>

          {/* Center Speed Badges */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            {/* Download */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/40">
              <ArrowDownCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">Download</span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatSpeed(current.downloadKbps)}
                </span>
              </div>
            </div>

            {/* Upload */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/40">
              <ArrowUpCircle className="w-4 h-4 text-cyan-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">Upload</span>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  {formatSpeed(current.uploadKbps)}
                </span>
              </div>
            </div>

            {/* Total In/Out */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/40 font-mono text-xs">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                In: <span className="font-bold">{current.totalRxMb >= 1024 ? `${(current.totalRxMb / 1024).toFixed(1)}GB` : `${current.totalRxMb}MB`}</span> • Out: <span className="font-bold">{current.totalTxMb >= 1024 ? `${(current.totalTxMb / 1024).toFixed(1)}GB` : `${current.totalTxMb}MB`}</span>
              </span>
            </div>

            {/* Saturation badge */}
            <div className={`text-[11px] px-2.5 py-1 rounded-xl font-semibold border ${loadColor}`}>
              {loadStatus}
            </div>

            {/* Speed Test Modal Trigger */}
            <button
              onClick={() => setShowSpeedModal(true)}
              className="px-2.5 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title="Run Live ISP Speed Test & Speedometer"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Speed Test</span>
            </button>

            {/* Toggle Graph Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-xs font-medium"
              title={isExpanded ? 'Collapse graph' : 'Expand bandwidth oscilloscope waves'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="hidden sm:inline">{isExpanded ? 'Hide Waves' : 'Show Waves'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Wave Oscilloscope */}
        {isExpanded && (
          <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
              <span className="font-medium text-[11px] text-slate-600 dark:text-slate-400">
                Live Throughput Waves (KB/s) • Peak: {formatSpeed(current.peakDownloadKbps)} Down / {formatSpeed(current.peakUploadKbps)} Up
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Download
                </span>
                <span className="flex items-center gap-1 text-cyan-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" /> Upload
                </span>
              </div>
            </div>

            <div className="h-32 w-full">
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="downGradRibbon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="upGradRibbon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white shadow-xl space-y-0.5">
                              <p className="font-mono text-[10px] text-slate-400">{label}</p>
                              <p className="text-emerald-400 font-bold">↓ {payload[0]?.value} KB/s</p>
                              <p className="text-cyan-400 font-bold">↑ {payload[1]?.value} KB/s</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="download"
                      stroke="#10b981"
                      strokeWidth={1.8}
                      fillOpacity={1}
                      fill="url(#downGradRibbon)"
                    />
                    <Area
                      type="monotone"
                      dataKey="upload"
                      stroke="#06b6d4"
                      strokeWidth={1.8}
                      fillOpacity={1}
                      fill="url(#upGradRibbon)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  <Activity className="w-3.5 h-3.5 animate-spin text-cyan-500 mr-2" />
                  Calibrating bandwidth telemetry stream...
                </div>
              )}
            </div>
          </div>
        )}
        </div>
        <LiveSpeedMeterModal
          isOpen={showSpeedModal}
          onClose={() => setShowSpeedModal(false)}
        />
      </>
    );
  }

  // -------------------------------------------------------------
  // Full Widget Mode (for OverviewPage)
  // -------------------------------------------------------------
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Activity className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Live Interface Bandwidth Telemetry
              </h3>
              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isLiveWs
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
              }`}>
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                {isLiveWs ? 'WebSocket 1s' : 'Live Sync'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time hardware adapter Rx/Tx throughput speed & rolling traffic waves
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowSpeedModal(true)}
            className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            title="Launch live ISP speed benchmark and speedometer"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Speedometer & Benchmark</span>
          </button>
          <div className={`text-xs px-3 py-1.5 rounded-xl font-semibold border ${loadColor}`}>
            {loadStatus}
          </div>
        </div>
      </div>

      {/* KPI Speed Meters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Current Download */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
              Download Speed
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatSpeed(current.downloadKbps)}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Peak: {formatSpeed(current.peakDownloadKbps)}
          </p>
        </div>

        {/* Current Upload */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <ArrowUpCircle className="w-4 h-4 text-cyan-500" />
              Upload Speed
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
            {formatSpeed(current.uploadKbps)}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Peak: {formatSpeed(current.peakUploadKbps)}
          </p>
        </div>

        {/* Total Data Rx */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-4 h-4 text-indigo-500" />
              Total Received
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {current.totalRxMb >= 1024
              ? `${(current.totalRxMb / 1024).toFixed(2)} GB`
              : `${current.totalRxMb} MB`}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Session Cumulative In</p>
        </div>

        {/* Total Data Tx */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Gauge className="w-4 h-4 text-purple-500" />
              Total Transmitted
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {current.totalTxMb >= 1024
              ? `${(current.totalTxMb / 1024).toFixed(2)} GB`
              : `${current.totalTxMb} MB`}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Session Cumulative Out</p>
        </div>
      </div>

      {/* Real-Time Area Waves Chart */}
      <div className="pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Throughput Velocity (KB/s)</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Download
            </span>
            <span className="flex items-center gap-1 text-cyan-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              Upload
            </span>
          </div>
        </div>

        <div className="h-44 w-full">
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white shadow-xl space-y-1">
                          <p className="font-mono text-slate-400">{label}</p>
                          <p className="text-emerald-400 font-bold">
                            ↓ Download: {payload[0]?.value} KB/s
                          </p>
                          <p className="text-cyan-400 font-bold">
                            ↑ Upload: {payload[1]?.value} KB/s
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="download"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#downGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="upload"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#upGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-spin text-cyan-500" />
                Calibrating bandwidth telemetry stream...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Live Speed Meter & Benchmark Modal */}
      <LiveSpeedMeterModal
        isOpen={showSpeedModal}
        onClose={() => setShowSpeedModal(false)}
      />
    </div>
  );
}
