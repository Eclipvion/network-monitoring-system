import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  AlertTriangle,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Layers,
  Search,
  ExternalLink,
  ChevronDown,
  Sliders,
  CalendarRange,
  Hash
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import api from '../services/api';

export default function ReportsPage({ devices = [], initialDeviceId = 'all' }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDeviceId);
  
  // Date Range Modes: 'preset' | 'custom_dates' | 'custom_days'
  const [rangeMode, setRangeMode] = useState('preset');
  const [rangePreset, setRangePreset] = useState('7d'); // '24h', '3d', '7d', '14d', '30d', '90d'
  
  // Custom Date Range states (Format: YYYY-MM-DDTHH:mm)
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [customTo, setCustomTo] = useState(() => {
    return new Date().toISOString().slice(0, 16);
  });

  // Custom Days Number input (User can specify any number of days, e.g. 45, 60, 180)
  const [customDaysCount, setCustomDaysCount] = useState(45);

  const [incidentSearch, setIncidentSearch] = useState('');
  const [incidentFilterStatus, setIncidentFilterStatus] = useState('ALL'); // 'ALL', 'RESOLVED', 'ACTIVE'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  // Helper function to build API query parameters for both fetch and export
  const buildReportParams = useCallback((format = null) => {
    const params = {
      deviceId: selectedDeviceId
    };
    if (format) params.format = format;

    if (rangeMode === 'custom_dates') {
      params.from = new Date(customFrom).toISOString();
      params.to = new Date(customTo).toISOString();
    } else if (rangeMode === 'custom_days') {
      params.days = Math.max(0.1, Number(customDaysCount) || 7);
    } else {
      const daysMap = {
        '24h': 1,
        '3d': 3,
        '7d': 7,
        '14d': 14,
        '30d': 30,
        '90d': 90
      };
      params.days = daysMap[rangePreset] || 7;
    }
    return params;
  }, [selectedDeviceId, rangeMode, rangePreset, customFrom, customTo, customDaysCount]);

  // Fetch report analytics from backend
  const fetchReport = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const params = buildReportParams();
      const res = await api.getReportAnalytics(params);
      setReportData(res);
    } catch (err) {
      console.error('Failed to load report analytics:', err);
      setError(err.message || 'Error generating report analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildReportParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Open PDF printable report in new tab with the exact custom date range
  const handleOpenPdfReport = () => {
    const params = buildReportParams('html');
    const url = api.getReportExportUrl(params);
    window.open(url, '_blank');
  };

  // Download CSV export with the exact custom date range
  const handleDownloadCsv = () => {
    const params = buildReportParams('csv');
    const url = api.getReportExportUrl(params);
    window.location.href = url;
  };

  // Quick date shortcut setters
  const applyDateShortcut = (type) => {
    const now = new Date();
    const toStr = now.toISOString().slice(0, 16);
    let fromDate = new Date();

    if (type === 'today') {
      fromDate.setHours(0, 0, 0, 0);
    } else if (type === 'yesterday') {
      fromDate.setDate(fromDate.getDate() - 1);
      fromDate.setHours(0, 0, 0, 0);
      const toYesterday = new Date();
      toYesterday.setDate(toYesterday.getDate() - 1);
      toYesterday.setHours(23, 59, 59, 999);
      setCustomFrom(fromDate.toISOString().slice(0, 16));
      setCustomTo(toYesterday.toISOString().slice(0, 16));
      setRangeMode('custom_dates');
      return;
    } else if (type === '7d') {
      fromDate.setDate(fromDate.getDate() - 7);
    } else if (type === '30d') {
      fromDate.setDate(fromDate.getDate() - 30);
    } else if (type === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (type === 'all') {
      fromDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days ago
    }

    setCustomFrom(fromDate.toISOString().slice(0, 16));
    setCustomTo(toStr);
    setRangeMode('custom_dates');
  };

  const metrics = reportData?.metrics || {};
  const filter = reportData?.filter || {};
  const incidents = reportData?.incidents || [];
  const timeSeries = (reportData?.timeSeries || []).filter(t => t.status !== 'NO_DATA');
  const deviceSummaries = reportData?.deviceSummaries || [];
  const branding = reportData?.branding || {};
  const compliance = reportData?.compliance || {};
  const flappingDevices = reportData?.flappingDevices || [];

  // Filter incidents list
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      inc.deviceName.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      inc.deviceIp.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      (inc.reason || '').toLowerCase().includes(incidentSearch.toLowerCase());

    const matchesStatus =
      incidentFilterStatus === 'ALL' ||
      (incidentFilterStatus === 'RESOLVED' && inc.isResolved) ||
      (incidentFilterStatus === 'ACTIVE' && !inc.isResolved);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Controls Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Reports & Downtime Audit
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Custom date range SLA availability audits, root-cause outage logs, and visual latency performance reports.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchReport}
              disabled={refreshing}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleDownloadCsv}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              Export CSV
            </button>

            <button
              onClick={handleOpenPdfReport}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              Generate & Download PDF Report
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
          {/* Device Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Device Scope
            </label>
            <div className="relative">
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none font-medium"
              >
                <option value="all">All Monitored Devices ({devices.length})</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ip})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Date Range Mode Selector */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Date Range Mode
            </label>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
              <button
                onClick={() => setRangeMode('preset')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rangeMode === 'preset'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Quick Presets
              </button>

              <button
                onClick={() => setRangeMode('custom_dates')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rangeMode === 'custom_dates'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Custom Date Range (Calendars)
              </button>

              <button
                onClick={() => setRangeMode('custom_days')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rangeMode === 'custom_days'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                Custom Days (Number)
              </button>
            </div>
          </div>

          {/* Active Range Summary Info */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Active Scope & Range
            </label>
            <div className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                {filter.deviceName || 'All Devices'}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {filter.isCustomRange ? `Custom Range (${filter.days}d)` : `${filter.days || 7} Days Window`}
              </div>
            </div>
          </div>
        </div>

        {/* MODE 1: Presets Toolbar */}
        {rangeMode === 'preset' && (
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-semibold uppercase text-slate-400 mr-1">Choose Preset:</span>
            {[
              { id: '24h', label: 'Last 24 Hours' },
              { id: '3d', label: 'Last 3 Days' },
              { id: '7d', label: 'Last 7 Days (1 Week)' },
              { id: '14d', label: 'Last 14 Days (2 Weeks)' },
              { id: '30d', label: 'Last 30 Days (1 Month)' },
              { id: '90d', label: 'Last 90 Days (Quarter)' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setRangePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rangePreset === p.id
                    ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* MODE 2: Custom Date Range (Calendars & Shortcuts) */}
        {rangeMode === 'custom_dates' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4 text-emerald-500" />
                Select Custom Date & Time Boundaries
              </span>
              {/* Quick Date Shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Shortcuts:</span>
                <button
                  type="button"
                  onClick={() => applyDateShortcut('today')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut('yesterday')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut('7d')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  Last 7d
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut('30d')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  Last 30d
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut('month')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut('all')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  All Time
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">From (Start):</span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">To (End):</span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <button
                type="button"
                onClick={fetchReport}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
              >
                Apply Custom Range
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: Custom Days Number Input */}
        {rangeMode === 'custom_days' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-500" />
              Specify Exact Number of Days (Jitne Din Chaho Type Karo)
            </span>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Days Count:</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDaysCount}
                  onChange={(e) => setCustomDaysCount(e.target.value)}
                  className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold focus:ring-2 focus:ring-emerald-500/50"
                />
                <span className="text-slate-400">days ago until now</span>
              </div>

              {/* Quick Days Preset Tags */}
              <div className="flex items-center gap-1.5">
                {[15, 45, 60, 100, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setCustomDaysCount(d);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      Number(customDaysCount) === d
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={fetchReport}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm ml-auto"
              >
                Apply Days
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Organization Branding & SLA Status Banner */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-emerald-500/20">
            {branding.organizationName ? branding.organizationName.slice(0, 2).toUpperCase() : 'NP'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {branding.organizationName || 'NetPulse Enterprise'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                AUDITED REPORT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {branding.reportSubtitle || 'Infrastructure SLA & Downtime Audit Report'}
            </p>
          </div>
        </div>

        {/* SLA & Health Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Health Index */}
          <div className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-indigo-500">Fleet Health:</span>
            <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
              {compliance.healthScore ?? 100}/100
            </span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-500 text-white text-[10px] font-black">
              {compliance.healthGrade || 'A+'}
            </span>
          </div>

          {/* SLA Compliance */}
          <div className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 ${
            compliance.slaStatus === 'SLA_MET'
              ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
          }`}>
            <span className="text-[11px] font-semibold">SLA Commitment:</span>
            <span className="text-xs font-bold">
              {compliance.slaStatus === 'SLA_MET' ? '✓ TARGET MET' : '⚠ SLA BREACHED'}
            </span>
            <span className="text-[10px] font-mono opacity-80">
              (Actual: {metrics.uptimePercent}% / Target: {compliance.targetSlaPercent || 99.9}%)
            </span>
          </div>
        </div>
      </div>

      {/* Flapping Host Warning Alert */}
      {flappingDevices.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-700 dark:text-amber-300">
              Network Link Flapping Detected ({flappingDevices.length} hosts unstable)
            </span>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Recurring outage cycles (&gt;= 3 incidents) were recorded during this period:{' '}
              <span className="font-semibold text-amber-800 dark:text-amber-200">
                {flappingDevices.map(d => `${d.name} (${d.ip}) [${d.incidentsCount} incidents]`).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Uptime % */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Availability Uptime
          </span>
          <div
            className={`text-2xl font-bold font-mono ${
              (metrics.uptimePercent || 100) >= (compliance.targetSlaPercent || 99.9)
                ? 'text-emerald-500'
                : (metrics.uptimePercent || 100) >= 95
                ? 'text-amber-500'
                : 'text-rose-500'
            }`}
          >
            {metrics.uptimePercent !== undefined ? `${metrics.uptimePercent}%` : '—'}
          </div>
          <p className="text-[10px] text-slate-400">Target SLA: {compliance.targetSlaPercent || 99.9}%</p>
        </div>

        {/* Total Outages */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Downtime Incidents
          </span>
          <div
            className={`text-2xl font-bold font-mono ${
              (metrics.totalIncidents || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'
            }`}
          >
            {metrics.totalIncidents ?? 0}
          </div>
          <p className="text-[10px] text-slate-400">
            {metrics.totalIncidents === 0 ? 'Zero Outages' : 'Recorded Outages'}
          </p>
        </div>

        {/* Cumulative Outage Duration */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Outage Duration
          </span>
          <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100 truncate">
            {metrics.totalDowntimeFormatted || '0s'}
          </div>
          <p className="text-[10px] text-slate-400">Cumulative Down Time</p>
        </div>

        {/* MTTR */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Avg MTTR (Recovery)
          </span>
          <div className="text-xl font-bold font-mono text-blue-500 truncate">
            {metrics.mttrFormatted || '0s'}
          </div>
          <p className="text-[10px] text-slate-400">Mean Time to Restore</p>
        </div>

        {/* Avg Latency */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Avg Roundtrip Latency
          </span>
          <div className="text-2xl font-bold font-mono text-indigo-500">
            {metrics.avgLatency !== null && metrics.avgLatency !== undefined ? `${metrics.avgLatency}ms` : '—'}
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Min: {metrics.minLatency ?? '—'} / Max: {metrics.maxLatency ?? '—'}ms
          </p>
        </div>

        {/* Probes Evaluated */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Probes Evaluated
          </span>
          <div className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-200">
            {metrics.totalChecks?.toLocaleString() || 0}
          </div>
          <p className="text-[10px] text-slate-400">
            Avg Loss: {metrics.avgPacketLoss || 0}%
          </p>
        </div>
      </div>

      {/* Availability Status Distribution Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h4 className="font-bold text-slate-900 dark:text-white">
              Availability Probing Distribution
            </h4>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="text-emerald-500 font-bold">
              UP: {metrics.pureUptimePercent}% ({metrics.upChecks || 0})
            </span>
            <span className="text-amber-500 font-bold">
              WARNING: {metrics.warningPercent}% ({metrics.warningChecks || 0})
            </span>
            <span className="text-rose-500 font-bold">
              DOWN: {metrics.downtimePercent}% ({metrics.downChecks || 0})
            </span>
          </div>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          <div
            style={{ width: `${metrics.pureUptimePercent || 100}%` }}
            className="bg-emerald-500 transition-all duration-300"
            title={`UP: ${metrics.pureUptimePercent}%`}
          />
          <div
            style={{ width: `${metrics.warningPercent || 0}%` }}
            className="bg-amber-500 transition-all duration-300"
            title={`WARNING: ${metrics.warningPercent}%`}
          />
          <div
            style={{ width: `${metrics.downtimePercent || 0}%` }}
            className="bg-rose-500 transition-all duration-300"
            title={`DOWN: ${metrics.downtimePercent}%`}
          />
        </div>
      </div>

      {/* Visual Chart: Latency & Packet Loss Trend Graph */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Latency & Packet Loss Timeline ({filter.isCustomRange ? `Custom Range (${filter.days}d)` : `${filter.days || 7} Days`})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historical response time curve with packet loss spikes across the selected date range.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Latency (ms)
            </span>
            <span className="flex items-center gap-1.5 text-rose-500">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Packet Loss (%)
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="reportLossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(val, name) => [
                    name === 'latency' ? `${val} ms` : `${val}%`,
                    name === 'latency' ? 'Latency' : 'Packet Loss'
                  ]}
                  labelFormatter={(lbl) => `Time: ${lbl}`}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#reportLatencyGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="packetLoss"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#reportLossGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No probe telemetry found in the selected range.
            </div>
          )}
        </div>
      </div>

      {/* Outage & Downtime Incidents Table ("Up and Down time kab aya or q sahi") */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Outage & Incident History (Failure Cause Analysis)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detailed record of when device went DOWN, when recovery occurred, duration, and root cause error.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search incidents / cause..."
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Status Filter */}
            <select
              value={incidentFilterStatus}
              onChange={(e) => setIncidentFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="ALL">All Incidents ({incidents.length})</option>
              <option value="RESOLVED">Resolved Only</option>
              <option value="ACTIVE">Active Outages Only</option>
            </select>
          </div>
        </div>

        {/* Incidents Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase text-slate-400">
                <th className="py-3 px-4">Device & Host</th>
                <th className="py-3 px-4">Went DOWN (Timestamp)</th>
                <th className="py-3 px-4">Recovered UP (Timestamp)</th>
                <th className="py-3 px-4">Outage Duration</th>
                <th className="py-3 px-4">Root Cause / Error Message</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map((inc) => {
                  const isOngoing = !inc.isResolved;
                  return (
                    <tr
                      key={inc.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isOngoing ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {inc.deviceName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {inc.deviceIp}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-rose-500 font-medium">
                        {new Date(inc.downAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium">
                        {inc.upAt ? (
                          <span className="text-emerald-500">
                            {new Date(inc.upAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold animate-pulse">
                            Currently Active (Down)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {inc.durationFormatted}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs break-words">
                        {inc.reason}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOngoing
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                          }`}
                        >
                          {isOngoing ? 'ACTIVE OUTAGE' : 'RESOLVED'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-xs text-slate-400">
                    {incidents.length === 0
                      ? '✓ No downtime incidents recorded in this time period! All devices operating normally.'
                      : 'No incidents match the search filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monitored Devices Summary Matrix */}
      {selectedDeviceId === 'all' && deviceSummaries.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Network Device Inventory & SLA Matrix ({filter.isCustomRange ? `Custom Range (${filter.days}d)` : `${filter.days || 7} Days`})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Individual uptime breakdown, outage frequency, and response times per device.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase text-slate-400">
                  <th className="py-3 px-4">Device Name</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Probes</th>
                  <th className="py-3 px-4 text-right">Uptime %</th>
                  <th className="py-3 px-4 text-right">Outages (Downtime)</th>
                  <th className="py-3 px-4 text-right">Avg Latency</th>
                  <th className="py-3 px-4 text-center">Current Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {deviceSummaries.map((dev) => {
                  const isUp = dev.currentStatus === 'UP';
                  const isDown = dev.currentStatus === 'DOWN';
                  const isWarn = dev.currentStatus === 'WARNING';

                  let badgeColor = 'bg-slate-500/10 text-slate-500';
                  if (isUp) badgeColor = 'bg-emerald-500/10 text-emerald-500';
                  else if (isDown) badgeColor = 'bg-rose-500/10 text-rose-500';
                  else if (isWarn) badgeColor = 'bg-amber-500/10 text-amber-500';

                  return (
                    <tr key={dev.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{dev.name}</span>
                          {dev.isFlapping && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              FLAPPING
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {dev.ip}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-500 dark:text-slate-400">
                        {dev.type}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-300">
                        {dev.totalChecks}
                      </td>
                      <td
                        className={`py-3 px-4 font-mono font-bold text-right ${
                          dev.uptimePercent >= 99
                            ? 'text-emerald-500'
                            : dev.uptimePercent >= 95
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`}
                      >
                        {dev.uptimePercent}%
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-300">
                        <span className={dev.incidentsCount > 0 ? 'text-rose-500 font-bold' : ''}>
                          {dev.incidentsCount} ({dev.totalDowntimeFormatted})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-300">
                        {dev.avgLatency !== 'N/A' ? `${dev.avgLatency}ms` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
                          {dev.currentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDeviceId(String(dev.id));
                          }}
                          className="text-xs text-emerald-500 hover:text-emerald-600 font-semibold"
                        >
                          Device Report &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
