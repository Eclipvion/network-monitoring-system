import React, { useState, useMemo } from 'react';
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
  XCircle,
  PauseCircle,
  Search,
  Filter,
  Download,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Grid3X3,
  List,
  Copy,
  Check,
  MapPin,
  RefreshCw,
  Bell,
  SlidersHorizontal,
  ChevronRight,
  X
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import BandwidthWidget from '../components/BandwidthWidget';
import api from '../services/api';

export default function MonitoringPage({
  devices = [],
  liveEvents = [],
  onOpenDetails,
  onRefreshDevices
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'compact', 'table'
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [isNocFullscreen, setIsNocFullscreen] = useState(false);

  const [pingingId, setPingingId] = useState(null);
  const [copiedIp, setCopiedIp] = useState(null);

  // Compute live statistics
  const total = devices.length;
  const upCount = devices.filter(d => d.status === 'UP').length;
  const warnCount = devices.filter(d => d.status === 'WARNING').length;
  const downCount = devices.filter(d => d.status === 'DOWN').length;
  const pausedCount = devices.filter(d => d.status === 'PAUSED' || !d.monitoring).length;

  const upPct = total > 0 ? Math.round((upCount / total) * 100) : 0;
  const warnPct = total > 0 ? Math.round((warnCount / total) * 100) : 0;
  const downPct = total > 0 ? Math.round((downCount / total) * 100) : 0;
  const pausedPct = total > 0 ? Math.round((pausedCount / total) * 100) : 0;

  // Extract unique groups
  const groups = useMemo(() => {
    return Array.from(new Set(devices.map(d => d.group || 'Default'))).filter(Boolean);
  }, [devices]);

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.group && d.group.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = typeFilter === 'ALL' || d.type.toLowerCase() === typeFilter.toLowerCase();
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PAUSED'
          ? d.status === 'PAUSED' || !d.monitoring
          : d.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesGroup = groupFilter === 'ALL' || (d.group || 'Default') === groupFilter;

      return matchesSearch && matchesType && matchesStatus && matchesGroup;
    });
  }, [devices, searchTerm, typeFilter, statusFilter, groupFilter]);

  const handlePingNow = async (deviceId, e) => {
    e?.stopPropagation();
    setPingingId(deviceId);
    try {
      await api.pingNow(deviceId);
      if (onRefreshDevices) {
        await onRefreshDevices();
      }
    } catch (err) {
      console.error('Instant ping failed:', err);
    } finally {
      setPingingId(null);
    }
  };

  const handleCopyIp = (ip, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1500);
  };

  const handleExportCsv = () => {
    const url = api.getMonitoringExportUrl({
      type: typeFilter,
      status: statusFilter
    });
    window.open(url, '_blank');
  };

  return (
    <div className={`space-y-6 ${isNocFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>
      {/* Live Health Overview Bar */}
      <div className="p-5 rounded-2xl glass-panel space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Live Sensor Telemetry Array
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Real-Time WebSocket
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Continuous network latency, packet loss, and sensor availability monitoring
              </p>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Total: {total}
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'UP' ? 'ALL' : 'UP')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'UP'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {upCount} UP ({upPct}%)
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'WARNING' ? 'ALL' : 'WARNING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'WARNING'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {warnCount} WARNING ({warnPct}%)
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'DOWN' ? 'ALL' : 'DOWN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'DOWN'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {downCount} DOWN ({downPct}%)
            </button>
          </div>
        </div>

        {/* Dynamic Multi-color Health Progress Track */}
        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          <div style={{ width: `${upPct}%` }} className="bg-emerald-500 transition-all duration-500" title={`UP: ${upPct}%`} />
          <div style={{ width: `${warnPct}%` }} className="bg-amber-500 transition-all duration-500" title={`WARNING: ${warnPct}%`} />
          <div style={{ width: `${downPct}%` }} className="bg-rose-500 transition-all duration-500" title={`DOWN: ${downPct}%`} />
          <div style={{ width: `${pausedPct}%` }} className="bg-slate-400 dark:bg-slate-600 transition-all duration-500" title={`PAUSED: ${pausedPct}%`} />
        </div>
      </div>

      {/* Real-Time Live Interface Bandwidth Telemetry Ribbon */}
      <BandwidthWidget variant="ribbon" />

      {/* Adaptive Controls Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sensors by name, IP, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="ALL">All Types</option>
            <option value="server">Servers</option>
            <option value="router">Routers</option>
            <option value="switch">Switches</option>
            <option value="workstation">Workstations / PCs</option>
            <option value="printer">Printers</option>
            <option value="gateway">Gateways</option>
            <option value="other">Other</option>
          </select>

          {groups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="ALL">All Locations</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
        </div>

        {/* View Switchers & Right Actions */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl text-xs border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Expanded Tiles Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'compact'
                  ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Compact NOC Sensor Matrix"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Data Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle Live Stream Drawer */}
          <button
            onClick={() => setIsFeedOpen(!isFeedOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              isFeedOpen
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isFeedOpen ? 'text-white' : 'text-amber-500'}`} />
            <span>Live Stream</span>
            {liveEvents.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isFeedOpen ? 'bg-amber-600 text-white' : 'bg-amber-500/20 text-amber-500'
              }`}>
                {liveEvents.length}
              </span>
            )}
          </button>

          {/* Export Report Button */}
          <button
            onClick={handleExportCsv}
            title="Export filtered monitoring view to CSV"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* NOC Fullscreen Toggle */}
          <button
            onClick={() => setIsNocFullscreen(!isNocFullscreen)}
            title={isNocFullscreen ? 'Exit Fullscreen' : 'NOC Fullscreen Mode'}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isNocFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Responsive Layout: Sensor Grid + Toggleable Feed Drawer */}
      <div className="flex gap-6 items-start">
        {/* Left Area: Main Sensors Display */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mode 1: Expanded Cards Grid (Fully Responsive across all screen sizes) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredDevices.map((device) => {
                const latest = device.latestResult;
                const isPinging = pingingId === device.id;
                const isUp = device.status === 'UP';
                const isDown = device.status === 'DOWN';
                const isWarning = device.status === 'WARNING';

                let statusBorder = 'border-slate-200 dark:border-slate-800';
                let topAccent = 'bg-slate-400';
                if (isUp) {
                  statusBorder = 'border-emerald-500/30 hover:border-emerald-500/60 shadow-sm';
                  topAccent = 'bg-emerald-500';
                } else if (isDown) {
                  statusBorder = 'border-rose-500/40 hover:border-rose-500/80 shadow-md shadow-rose-500/5';
                  topAccent = 'bg-rose-500';
                } else if (isWarning) {
                  statusBorder = 'border-amber-500/40 hover:border-amber-500/80 shadow-md shadow-amber-500/5';
                  topAccent = 'bg-amber-500';
                }

                // Latency color
                const lat = latest?.latency;
                let latColor = 'text-slate-400';
                if (lat !== null && lat !== undefined) {
                  if (lat < 100) latColor = 'text-emerald-500';
                  else if (lat < 250) latColor = 'text-amber-500';
                  else latColor = 'text-rose-500';
                }

                return (
                  <div
                    key={device.id}
                    onClick={() => onOpenDetails(device.id)}
                    className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${statusBorder} cursor-pointer flex flex-col justify-between space-y-3.5 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg group`}
                  >
                    {/* Top status indicator line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${topAccent}`} />

                    {/* Header: Name & Type & Badge */}
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-500 transition-colors">
                          {device.name}
                        </h4>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400 mt-0.5">
                          <span className="truncate">{device.ip}</span>
                          <button
                            onClick={(e) => handleCopyIp(device.ip, e)}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            title="Copy IP"
                          >
                            {copiedIp === device.ip ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <StatusBadge status={device.status} size="sm" />
                    </div>

                    {/* Metrics Box */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Response Time
                          </span>
                          <span className={`text-2xl font-bold font-mono ${latColor}`}>
                            {isPinging ? (
                              <span className="text-amber-500 text-sm flex items-center gap-1">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pinging...
                              </span>
                            ) : lat !== null && lat !== undefined ? (
                              `${lat} ms`
                            ) : (
                              '—'
                            )}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Loss / Jitter
                          </span>
                          <div className="flex items-center justify-end gap-1 font-mono text-xs">
                            <span className={`font-bold ${latest?.packetLoss > 0 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>
                              {latest?.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className={`font-bold ${
                              latest && typeof latest.jitter === 'number'
                                ? latest.jitter < 5 ? 'text-emerald-500' : latest.jitter < 20 ? 'text-blue-500' : 'text-amber-500'
                                : 'text-slate-400'
                            }`} title="PRTG Jitter Variance">
                              {latest && typeof latest.jitter === 'number' ? `±${latest.jitter}ms` : '0ms'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mini Latency Gauge Bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(8, (lat || 10) / 3))}%` }}
                          className={`h-full transition-all duration-300 ${
                            lat < 100 ? 'bg-emerald-500' : lat < 250 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Footer Info & Quick Actions */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="flex items-center gap-1 font-mono truncate">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        {latest?.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : 'Pending'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handlePingNow(device.id, e)}
                          disabled={isPinging}
                          className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                          title="⚡ Ping Now"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isPinging ? 'animate-bounce text-amber-500' : ''}`} />
                        </button>
                        <span className="text-emerald-500 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Details <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mode 2: Compact NOC Sensor Matrix (High-Density Wall Display) */}
          {viewMode === 'compact' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredDevices.map((device) => {
                const latest = device.latestResult;
                const isUp = device.status === 'UP';
                const isDown = device.status === 'DOWN';
                const isWarning = device.status === 'WARNING';

                const lat = latest?.latency;
                let dotColor = 'bg-slate-400';
                if (isUp) dotColor = 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
                else if (isDown) dotColor = 'bg-rose-500 animate-pulse';
                else if (isWarning) dotColor = 'bg-amber-500';

                return (
                  <div
                    key={device.id}
                    onClick={() => onOpenDetails(device.id)}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate flex-1">
                        {device.name}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {lat !== null && lat !== undefined ? `${lat}ms` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span className="truncate">{device.ip}</span>
                      <span>{latest?.packetLoss || 0}% loss</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mode 3: Data Table View */}
          {viewMode === 'table' && (
            <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase text-slate-400">
                      <th className="py-3.5 px-4">Device</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Response Time</th>
                      <th className="py-3.5 px-4">Packet Loss</th>
                      <th className="py-3.5 px-4">Jitter</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Last Probe</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredDevices.map((device) => {
                      const latest = device.latestResult;
                      const isPinging = pingingId === device.id;
                      return (
                        <tr
                          key={device.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          onClick={() => onOpenDetails(device.id)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {device.name}
                            </div>
                            <div className="font-mono text-slate-400 text-[11px]">
                              {device.ip}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={device.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            {isPinging ? (
                              <span className="text-amber-500">Pinging...</span>
                            ) : latest?.latency !== null && latest?.latency !== undefined ? (
                              <span className={latest.latency > 150 ? 'text-amber-500' : 'text-emerald-500'}>
                                {latest.latency} ms
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {latest?.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {latest && typeof latest.jitter === 'number' ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                latest.jitter < 5
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : latest.jitter < 20
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-amber-500/10 text-amber-500'
                              }`}>
                                {latest.jitter} ms
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {device.group || 'Local Network'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                            {latest?.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => handlePingNow(device.id, e)}
                                disabled={isPinging}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10"
                                title="⚡ Ping Now"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenDetails(device.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredDevices.length === 0 && (
            <div className="py-16 text-center space-y-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Activity className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No active sensors match the selected filters.
              </p>
            </div>
          )}
        </div>

        {/* Right Drawer: Live Telemetry Event Stream (Smoothly Toggleable) */}
        {isFeedOpen && (
          <aside className="w-80 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-[75vh] sticky top-6 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  Live Stream Ticker
                </h4>
              </div>
              <button
                onClick={() => setIsFeedOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-2">
              {liveEvents.map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
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
                    <span className="truncate">{evt.ip || '—'}</span>
                    <span className="font-bold text-emerald-500">
                      {evt.latency !== null && evt.latency !== undefined ? `${evt.latency}ms` : ''}
                    </span>
                  </div>

                  {evt.message && (
                    <p className="text-[10px] text-slate-400 italic truncate">
                      {evt.message}
                    </p>
                  )}
                </div>
              ))}

              {liveEvents.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-400">
                  Awaiting live WebSocket telemetry packets...
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
