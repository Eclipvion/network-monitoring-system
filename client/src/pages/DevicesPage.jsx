import React, { useState, useEffect } from 'react';
import {
  Server,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Power,
  ArrowUpRight,
  Wifi,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PauseCircle,
  Zap,
  Radar,
  Copy,
  Check,
  Globe,
  MapPin
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import NetworkScannerModal from '../components/NetworkScannerModal';
import api from '../services/api';

export default function DevicesPage({
  devices = [],
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onDeleteMultipleDevices,
  onToggleMonitoring,
  onOpenDetails,
  onRefreshDevices
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' | 'LOCAL' | 'PUBLIC'
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [copiedIp, setCopiedIp] = useState(null);

  const isLocalIp = (ipStr) => {
    if (!ipStr) return false;
    const clean = String(ipStr).split(':')[0].trim().toLowerCase();
    if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') return true;
    if (clean.startsWith('192.168.') || clean.startsWith('10.')) return true;
    if (clean.startsWith('172.')) {
      const parts = clean.split('.');
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1], 10);
        return secondOctet >= 16 && secondOctet <= 31;
      }
    }
    return false;
  };

  // Compute KPI Counts
  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.status === 'UP').length;
  const warningCount = devices.filter((d) => d.status === 'WARNING').length;
  const offlineCount = devices.filter((d) => d.status === 'DOWN').length;
  const pausedCount = devices.filter((d) => d.status === 'PAUSED' || !d.monitoring).length;

  const localOnlineCount = devices.filter((d) => (d.status === 'UP' || d.status === 'WARNING') && isLocalIp(d.ip)).length;
  const publicOnlineCount = devices.filter((d) => (d.status === 'UP' || d.status === 'WARNING') && !isLocalIp(d.ip)).length;

  // Extract unique groups
  const groups = Array.from(new Set(devices.map((d) => d.group || 'Default'))).filter(Boolean);

  // Filter devices
  const filteredDevices = devices.filter((d) => {
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

    const isLocal = isLocalIp(d.ip);
    const matchesScope =
      scopeFilter === 'ALL'
        ? true
        : scopeFilter === 'LOCAL'
        ? isLocal
        : !isLocal;

    return matchesSearch && matchesType && matchesStatus && matchesGroup && matchesScope;
  });

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

  // Multi-Selection State for Bulk Actions / Deletion
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Clean up selected IDs if devices were removed
  useEffect(() => {
    const existing = new Set(devices.map((d) => d.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (existing.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [devices]);

  const isAllFilteredSelected =
    filteredDevices.length > 0 && filteredDevices.every((d) => selectedIds.has(d.id));
  const isSomeFilteredSelected =
    filteredDevices.some((d) => selectedIds.has(d.id)) && !isAllFilteredSelected;

  const handleToggleSelect = (deviceId, e) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Unselect all currently filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredDevices.forEach((d) => next.delete(d.id));
        return next;
      });
    } else {
      // Select all currently filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredDevices.forEach((d) => next.add(d.id));
        return next;
      });
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredDevices.forEach((d) => next.add(d.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    const toDelete = devices.filter((d) => selectedIds.has(d.id));
    if (toDelete.length === 0) return;
    if (onDeleteMultipleDevices) {
      onDeleteMultipleDevices(toDelete);
    } else if (onDeleteDevice) {
      toDelete.forEach(onDeleteDevice);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Devices */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700 shadow-lg'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Devices</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{totalCount}</p>
        </button>

        {/* Online UP */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'UP' ? 'ALL' : 'UP')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'UP'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 mb-1">
            <span>Online (UP)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{onlineCount}</p>
          <p className="text-[10px] text-slate-400 font-sans mt-0.5">
            🏠 {localOnlineCount} LAN • 🌐 {publicOnlineCount} Cloud
          </p>
        </button>

        {/* Warning */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'WARNING'
              ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 mb-1">
            <span>Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{warningCount}</p>
        </button>

        {/* Offline DOWN */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'DOWN' ? 'ALL' : 'DOWN')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'DOWN'
              ? 'bg-rose-500/10 border-rose-500 text-rose-500 shadow-lg shadow-rose-500/10 ring-2 ring-rose-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 mb-1">
            <span>Offline (DOWN)</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{offlineCount}</p>
        </button>

        {/* Paused */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'PAUSED' ? 'ALL' : 'PAUSED')}
          className={`p-4 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            statusFilter === 'PAUSED'
              ? 'bg-slate-500/10 border-slate-500 text-slate-500 shadow-lg ring-2 ring-slate-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Paused</span>
            <PauseCircle className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-600 dark:text-slate-300">{pausedCount}</p>
        </button>
      </div>

      {/* Action Header & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, IP, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="ALL">All Networks</option>
            <option value="LOCAL">🏠 Local Wi-Fi LAN ({localOnlineCount} Up)</option>
            <option value="PUBLIC">🌐 Cloud & Public ({publicOnlineCount} Up)</option>
          </select>

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

        {/* View mode & Action Buttons */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Grid
            </button>
          </div>

          {/* Auto-Detect Devices Button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all shrink-0"
            title="Scan your local network subnet for active devices"
          >
            <Radar className="w-4 h-4" />
            <span>Auto-Detect Devices</span>
          </button>

          {/* Add Device Button */}
          <button
            onClick={onAddDevice}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Batch Selection Action Ribbon */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-amber-500/10 border border-rose-500/30 dark:border-rose-500/30 shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-rose-500 text-white font-bold text-xs shadow-sm">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {selectedIds.size === 1 ? '1 device selected' : `${selectedIds.size} devices selected`}
            </span>
            {filteredDevices.length > selectedIds.size && (
              <button
                onClick={handleSelectAllFiltered}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium ml-1"
              >
                Select all {filteredDevices.length} visible {groupFilter !== 'ALL' ? `in "${groupFilter}" section` : ''}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-500/25 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Table or Grid */}
      {viewMode === 'table' ? (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeFilteredSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-rose-500 focus:ring-rose-500 cursor-pointer accent-rose-500"
                      title={isAllFilteredSelected ? 'Deselect all visible' : 'Select all visible'}
                    />
                  </th>
                  <th className="py-3.5 px-4">Name & Host</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Interval</th>
                  <th className="py-3.5 px-4">Latest Latency</th>
                  <th className="py-3.5 px-4">Packet Loss</th>
                  <th className="py-3.5 px-4">Jitter</th>
                  <th className="py-3.5 px-4">Active</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                {filteredDevices.map((device) => {
                  const latest = device.latestResult;
                  const isPinging = pingingId === device.id;

                  return (
                    <tr
                      key={device.id}
                      className={`transition-colors ${
                        selectedIds.has(device.id)
                          ? 'bg-rose-500/10 dark:bg-rose-500/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(device.id)}
                          onChange={(e) => handleToggleSelect(device.id, e)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-rose-500 focus:ring-rose-500 cursor-pointer accent-rose-500"
                        />
                      </td>
                      <td
                        className="py-3.5 px-4 cursor-pointer"
                        onClick={() => onOpenDetails(device.id)}
                      >
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{device.name}</span>
                          {device.isSeed && (
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                              Seed
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                          <span>{device.ip}</span>
                          {isLocalIp(device.ip) ? (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-500 font-mono">
                              LAN
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 font-mono">
                              CLOUD
                            </span>
                          )}
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
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {device.group || 'Local Network'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                          {device.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={device.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {device.interval}s
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium">
                        {isPinging ? (
                          <span className="text-amber-500 flex items-center gap-1">
                            <Zap className="w-3 h-3 animate-spin" /> Pinging...
                          </span>
                        ) : latest && latest.latency !== null ? (
                          <span className={latest.latency > 150 ? 'text-amber-500' : 'text-emerald-500 font-bold'}>
                            {latest.latency} ms
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {latest && latest.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {latest && typeof latest.jitter === 'number' ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            latest.jitter < 5
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : latest.jitter < 20
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : latest.jitter < 35
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                          }`} title={`PRTG Jitter: ${latest.jitter} ms (${latest.jitter < 5 ? 'Rock Solid' : latest.jitter < 20 ? 'Good' : 'Elevated'})`}>
                            {latest.jitter} ms
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Monitoring Toggle Switch */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onToggleMonitoring(device.id, !device.monitoring)}
                          title={device.monitoring ? 'Disable monitoring' : 'Enable monitoring'}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            device.monitoring ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              device.monitoring ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Instant Ping Button */}
                          <button
                            onClick={(e) => handlePingNow(device.id, e)}
                            disabled={isPinging}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                            title="⚡ Ping Now (Instant Re-check)"
                          >
                            <Zap className={`w-4 h-4 ${isPinging ? 'animate-bounce text-amber-500' : ''}`} />
                          </button>

                          {/* Details */}
                          <button
                            onClick={() => onOpenDetails(device.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            title="Device Telemetry & Diagnostics"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onEditDevice(device)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                            title="Edit Device"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => onDeleteDevice(device)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Delete Device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredDevices.length === 0 && (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400 text-xs">
                      No matching devices found. Click "Auto-Detect Devices" to discover devices on your network.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => {
            const latest = device.latestResult;
            const isPinging = pingingId === device.id;

            return (
              <div
                key={device.id}
                className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm hover:shadow-md transition-all space-y-4 ${
                  selectedIds.has(device.id)
                    ? 'border-rose-500/50 ring-2 ring-rose-500/20 bg-rose-500/[0.03]'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(device.id)}
                      onChange={(e) => handleToggleSelect(device.id, e)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-rose-500 focus:ring-rose-500 cursor-pointer accent-rose-500 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="cursor-pointer" onClick={() => onOpenDetails(device.id)}>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {device.name}
                        </h4>
                        {device.isSeed && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 font-mono">
                            Seed
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{device.ip}</p>
                    </div>
                  </div>
                  <StatusBadge status={device.status} size="sm" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Latency</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                      {isPinging ? 'Pinging...' : latest && latest.latency !== null ? `${latest.latency} ms` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Loss</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                      {latest && latest.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Jitter</span>
                    <span className={`font-mono font-semibold ${
                      latest && typeof latest.jitter === 'number'
                        ? latest.jitter < 5 ? 'text-emerald-500' : latest.jitter < 20 ? 'text-blue-500' : 'text-amber-500'
                        : 'text-slate-400'
                    }`}>
                      {latest && typeof latest.jitter === 'number' ? `${latest.jitter} ms` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">{device.type}</span>
                    <span>•</span>
                    <span>{device.interval}s</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handlePingNow(device.id, e)}
                      disabled={isPinging}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                      title="⚡ Ping Now"
                    >
                      <Zap className={`w-4 h-4 ${isPinging ? 'animate-bounce text-amber-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => onOpenDetails(device.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      title="Details"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditDevice(device)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteDevice(device)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-Detect Network Scanner Modal Window */}
      <NetworkScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDevicesAdded={onRefreshDevices}
        existingDevices={devices}
      />
    </div>
  );
}
