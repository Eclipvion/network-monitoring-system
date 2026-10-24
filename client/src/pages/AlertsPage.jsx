import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Server,
  Filter,
  Check,
  RefreshCw,
  Trash2,
  RotateCcw,
  Search,
  Copy,
  CheckSquare,
  Square,
  Zap,
  TrendingUp,
  Activity,
  X,
  Radio,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import api from '../services/api';

export default function AlertsPage({
  alerts = [],
  onResolveAlert,
  onUnresolveAlert,
  loading = false,
  onRefresh
}) {
  // Filters & Search
  const [filter, setFilter] = useState('ACTIVE'); // 'ACTIVE' | 'RESOLVED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'DOWN' | 'LATENCY' | 'PACKET_LOSS'
  const [sortOrder, setSortOrder] = useState('NEWEST'); // 'NEWEST' | 'OLDEST'

  // Multi-select state for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Single alert loading state
  const [actingAlertId, setActingAlertId] = useState(null);
  const [copiedIp, setCopiedIp] = useState(null);

  // Copy helper
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const showFeedback = (msg) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Metrics
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.resolved), [alerts]);
  const resolvedAlerts = useMemo(() => alerts.filter((a) => a.resolved), [alerts]);
  const totalCount = alerts.length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedAlerts.length / totalCount) * 100) : 100;

  // Filtered & Sorted alerts list
  const displayAlerts = useMemo(() => {
    return alerts
      .filter((alert) => {
        // Status filter
        if (filter === 'ACTIVE' && alert.resolved) return false;
        if (filter === 'RESOLVED' && !alert.resolved) return false;

        // Type filter
        if (typeFilter !== 'ALL') {
          const alertType = String(alert.type || '').toUpperCase();
          if (typeFilter === 'DOWN' && alertType !== 'DOWN') return false;
          if (typeFilter === 'LATENCY' && !alertType.includes('LATENCY')) return false;
          if (typeFilter === 'PACKET_LOSS' && !alertType.includes('LOSS')) return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const dev = alert.device || {};
          const name = String(dev.name || alert.deviceName || '').toLowerCase();
          const ip = String(dev.ip || alert.deviceIp || '').toLowerCase();
          const msg = String(alert.message || '').toLowerCase();
          const id = String(alert.id || '').toLowerCase();

          return name.includes(q) || ip.includes(q) || msg.includes(q) || id.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
      });
  }, [alerts, filter, typeFilter, searchQuery, sortOrder]);

  // Selection handlers
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (selectedIds.size === displayAlerts.length && displayAlerts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayAlerts.map((a) => a.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Individual Actions
  const handleSingleResolve = async (id) => {
    try {
      setActingAlertId(id);
      if (onResolveAlert) {
        await onResolveAlert(id);
      } else {
        await api.resolveAlert(id);
        if (onRefresh) onRefresh();
      }
      showFeedback(`Alert #${id} marked as resolved!`);
    } catch (err) {
      alert(`Error resolving alert: ${err.message}`);
    } finally {
      setActingAlertId(null);
    }
  };

  const handleSingleUnresolve = async (id) => {
    try {
      setActingAlertId(id);
      if (onUnresolveAlert) {
        await onUnresolveAlert(id);
      } else {
        await api.unresolveAlert(id);
        if (onRefresh) onRefresh();
      }
      showFeedback(`Alert #${id} reopened / marked unresolved.`);
    } catch (err) {
      alert(`Error unresolving alert: ${err.message}`);
    } finally {
      setActingAlertId(null);
    }
  };

  const handleSingleDelete = async (id) => {
    if (!window.confirm(`Delete alert #${id} permanently from history?`)) return;
    try {
      setActingAlertId(id);
      await api.deleteAlert(id);
      if (onRefresh) onRefresh();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showFeedback(`Alert #${id} deleted.`);
    } catch (err) {
      alert(`Error deleting alert: ${err.message}`);
    } finally {
      setActingAlertId(null);
    }
  };

  // Bulk Actions
  const handleBulkResolve = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkActing(true);
    try {
      await api.batchResolveAlerts(ids);
      if (onRefresh) await onRefresh();
      setSelectedIds(new Set());
      showFeedback(`Successfully resolved ${ids.length} alert(s)!`);
    } catch (err) {
      alert(`Error resolving selected alerts: ${err.message}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleBulkUnresolve = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkActing(true);
    try {
      await api.batchUnresolveAlerts(ids);
      if (onRefresh) await onRefresh();
      setSelectedIds(new Set());
      showFeedback(`Successfully reopened / unresolved ${ids.length} alert(s)!`);
    } catch (err) {
      alert(`Error unresolving selected alerts: ${err.message}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete all ${ids.length} selected alert(s)?`)) return;
    setIsBulkActing(true);
    try {
      await api.batchDeleteAlerts(ids);
      if (onRefresh) await onRefresh();
      setSelectedIds(new Set());
      showFeedback(`Deleted ${ids.length} alert(s) from history.`);
    } catch (err) {
      alert(`Error deleting alerts: ${err.message}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleClearResolvedHistory = async () => {
    if (!window.confirm('Clear all resolved incident records from history?')) return;
    try {
      await api.clearResolvedAlerts();
      if (onRefresh) await onRefresh();
      setSelectedIds(new Set());
      showFeedback('Cleared all resolved alert history.');
    } catch (err) {
      alert(`Error clearing resolved alerts: ${err.message}`);
    }
  };

  const isAllSelected = displayAlerts.length > 0 && selectedIds.size === displayAlerts.length;

  return (
    <div className="space-y-6">
      {/* ACTION FEEDBACK TOAST */}
      {actionFeedback && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* TOP HEADER: INCIDENT COMMAND CENTER BANNER */}
      <div className="p-4 sm:p-6 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-slate-950 text-white relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(#f43f5e_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                Incident Command Center Active
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                Real-Time Telemetry Triggers
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
              <span>System Outages & Network Alert Log</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Automated outage alarms, latency threshold warnings, packet loss spikes, and bulk remediation controls across all monitored endpoints.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {resolvedAlerts.length > 0 && (
              <button
                onClick={handleClearResolvedHistory}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                title="Remove all resolved events from database"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear Resolved History</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors cursor-pointer"
              title="Refresh alerts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 HERO KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Active Incidents */}
        <div className={`p-4 sm:p-5 rounded-2xl glass-panel border shadow-sm transition-all ${
          activeAlerts.length > 0
            ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/20'
            : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Incidents
            </span>
            <div className={`p-2 rounded-xl ${
              activeAlerts.length > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-black tracking-tight ${activeAlerts.length > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {activeAlerts.length}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {activeAlerts.length === 1 ? 'host down' : 'hosts require attention'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {activeAlerts.length > 0 ? 'Immediate administrative intervention needed' : 'All monitored endpoints responding'}
          </p>
        </div>

        {/* Card 2: Resolved Incidents */}
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Resolved & Recovered
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-emerald-500">
              {resolvedAlerts.length}
            </span>
            <span className="text-xs text-slate-400 font-mono">closed incidents</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Recovered automatically or marked solved
          </p>
        </div>

        {/* Card 3: Resolution Rate */}
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mitigation Rate
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {resolutionRate}%
            </span>
            <span className="text-xs text-slate-400 font-mono">mitigated</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${resolutionRate}%` }}
            />
          </div>
        </div>

        {/* Card 4: Total Logged Events */}
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Recorded Alerts
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400 font-mono">historical events</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Tracked across all ICMP & TCP ping cycles
          </p>
        </div>
      </div>

      {/* BULK ACTION BAR (ACTIVE WHEN 1+ ALERTS ARE SELECTED) */}
      {selectedIds.size > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-700 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-rose-500 text-white font-mono font-bold text-xs">
              {selectedIds.size} Selected
            </span>
            <span className="text-xs text-slate-300">
              Apply bulk action across all checked incidents:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBulkResolve}
              disabled={isBulkActing}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Mark all selected alerts as resolved"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Resolved (Solve All)</span>
            </button>

            <button
              onClick={handleBulkUnresolve}
              disabled={isBulkActing}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Reopen all selected alerts as active/unresolved"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Mark Unresolved (Reopen All)</span>
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={isBulkActing}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Delete all selected alerts permanently"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected</span>
            </button>

            <button
              onClick={handleClearSelection}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Deselect all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOOLBAR: STATUS TABS, SEARCH, TYPE, SORT & SELECT ALL */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Segmented Controls */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('ACTIVE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                filter === 'ACTIVE'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Active</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeAlerts.length > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
              }`}>
                {activeAlerts.length}
              </span>
            </button>

            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                filter === 'RESOLVED'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Resolved</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 font-mono text-slate-700 dark:text-slate-300">
                {resolvedAlerts.length}
              </span>
            </button>

            <button
              onClick={() => setFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>All Events</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 font-mono text-slate-700 dark:text-slate-300">
                {totalCount}
              </span>
            </button>
          </div>

          {/* Select All Checkbox Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllVisible}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{isAllSelected ? 'Deselect All' : `Select All (${displayAlerts.length})`}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search device name, host IP, or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Alert Types</option>
              <option value="DOWN">Host DOWN Alarms</option>
              <option value="LATENCY">High Latency Warnings</option>
              <option value="PACKET_LOSS">Packet Loss Spikes</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
            </select>
          </div>

          <div className="text-xs text-slate-400">
            Showing <strong>{displayAlerts.length}</strong> of {totalCount} events
          </div>
        </div>
      </div>

      {/* ALERTS CARDS LIST (RESPONSIVE & TOUCH-FRIENDLY) */}
      <div className="space-y-3">
        {displayAlerts.map((alert) => {
          const device = alert.device || {};
          const isResolved = alert.resolved;
          const isSelected = selectedIds.has(alert.id);
          const isActing = actingAlertId === alert.id;
          const hostIp = device.ip || alert.deviceIp || '';
          const hostName = device.name || alert.deviceName || `Device #${alert.deviceId}`;

          return (
            <div
              key={alert.id}
              className={`p-4 sm:p-5 rounded-2xl glass-panel border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/30'
                  : isResolved
                    ? 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 opacity-80'
                    : 'border-rose-500/30 bg-rose-500/5 ring-1 ring-rose-500/10'
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                {/* Selection Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleSelect(alert.id)}
                  className="mt-1 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-blue-500" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </button>

                {/* Severity Status Icon */}
                <div className={`p-3 rounded-2xl shrink-0 ${
                  isResolved
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-rose-500/15 text-rose-500 animate-pulse'
                }`}>
                  {isResolved ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {hostName}
                    </span>

                    {hostIp && (
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                        <span>{hostIp}</span>
                        <button
                          onClick={() => handleCopy(hostIp)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy IP"
                        >
                          {copiedIp === hostIp ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    <StatusBadge status={alert.type || 'DOWN'} size="sm" pulse={!isResolved} />

                    {isResolved ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                        Resolved
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-mono animate-pulse">
                        Unresolved
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {alert.message || 'Host ping failed consecutive retry threshold.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Triggered: {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    {alert.resolvedAt && (
                      <span className="text-emerald-500 font-semibold">
                        Resolved: {new Date(alert.resolvedAt).toLocaleTimeString()}
                      </span>
                    )}
                    <span className="text-slate-500">
                      ID: #{String(alert.id).slice(-8)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Solve / Unresolve Toggle & Delete) */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                {isResolved ? (
                  <button
                    onClick={() => handleSingleUnresolve(alert.id)}
                    disabled={isActing}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Mark unresolved / reopen incident"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isActing ? 'animate-spin' : ''}`} />
                    <span>Reopen / Unresolve</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSingleResolve(alert.id)}
                    disabled={isActing}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    title="Mark alert as solved"
                  >
                    <Check className={`w-3.5 h-3.5 ${isActing ? 'animate-spin' : ''}`} />
                    <span>Mark Resolved</span>
                  </button>
                )}

                <button
                  onClick={() => handleSingleDelete(alert.id)}
                  disabled={isActing}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete alert"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {displayAlerts.length === 0 && (
          <div className="p-16 text-center rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              No matching alerts found
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              {filter === 'ACTIVE'
                ? 'All monitored hosts are responding normally. Zero active downtime incidents.'
                : 'No alerts match the current filter or search criteria.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
