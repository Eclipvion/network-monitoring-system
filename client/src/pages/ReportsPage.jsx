import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Activity,
  ChevronDown,
  CalendarRange,
  Hash,
  Mail,
  Server,
  FileSpreadsheet,
  ShieldCheck,
  Award
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

// Modular Subcomponents
import ReportKpiGrid from '../components/reports/ReportKpiGrid';
import IncidentAuditTable from '../components/reports/IncidentAuditTable';
import DeviceSlaMatrixTable from '../components/reports/DeviceSlaMatrixTable';
import ComplianceAuditTab from '../components/reports/ComplianceAuditTab';
import ScheduledEmailModal from '../components/reports/ScheduledEmailModal';
import OutageTrackerWidget from '../components/OutageTrackerWidget';
import api from '../services/api';

export default function ReportsPage({ devices = [], initialDeviceId = 'all' }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDeviceId);
  const [activeReportTab, setActiveReportTab] = useState('all'); // 'all' | 'overview' | 'incidents' | 'devices' | 'compliance'

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

  // Custom Days Number input
  const [customDaysCount, setCustomDaysCount] = useState(45);

  const [showEmailModal, setShowEmailModal] = useState(false);
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
      return;
    } else if (type === '7d') {
      fromDate.setDate(fromDate.getDate() - 7);
    } else if (type === '30d') {
      fromDate.setDate(fromDate.getDate() - 30);
    } else if (type === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (type === 'all') {
      fromDate.setDate(fromDate.getDate() - 180);
    }

    setCustomFrom(fromDate.toISOString().slice(0, 16));
    setCustomTo(toStr);
  };

  if (loading && !reportData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Synthesizing network telemetry & calculating SLA audit metrics...</p>
      </div>
    );
  }

  const {
    filter = {},
    metrics = {},
    incidents = [],
    timeSeries = [],
    deviceSummaries = [],
    branding = {},
    compliance = {},
    flappingDevices = []
  } = reportData || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Controls Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Reports & Audits Suite
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Custom date range SLA availability audits, root-cause outage logs, and compliance verification reports.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchReport}
              disabled={refreshing}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleDownloadCsv}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              Export CSV
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Configure automated scheduled daily/weekly report emails"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-500" />
              Automated Email Schedule
            </button>

            <button
              onClick={handleOpenPdfReport}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              Generate PDF Report
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
                Custom Range
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
                Custom Days
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

        {/* MODE 2: Custom Date Range */}
        {rangeMode === 'custom_dates' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4 text-emerald-500" />
                Select Custom Date & Time Boundaries
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Shortcuts:</span>
                {['today', 'yesterday', '7d', '30d', 'month', 'all'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applyDateShortcut(s)}
                    className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white transition-colors capitalize text-[10px] font-semibold"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">From:</span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">To:</span>
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
                Apply Range
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: Custom Days Number Input */}
        {rangeMode === 'custom_days' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-500" />
              Specify Exact Days Count
            </span>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Days:</span>
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

              <div className="flex items-center gap-1.5">
                {[15, 45, 60, 100, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCustomDaysCount(d)}
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

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto text-xs font-bold scrollbar-none">
        {[
          { id: 'all', label: 'Complete Executive Report', icon: FileSpreadsheet },
          { id: 'overview', label: 'SLA & Latency Waves', icon: Activity },
          { id: 'incidents', label: `Outage Incidents (${incidents.length})`, icon: AlertTriangle },
          { id: 'devices', label: `Device Inventory Matrix (${deviceSummaries.length})`, icon: Server },
          { id: 'compliance', label: 'Compliance & NOC Audit Checklist', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Organization Branding & SLA Status Banner (shown on all or overview or compliance) */}
      {(activeReportTab === 'all' || activeReportTab === 'overview' || activeReportTab === 'compliance') && (
        <div className="glass-panel p-4 px-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
            <div className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-indigo-500">Fleet Health:</span>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {compliance.healthScore ?? 100}/100
              </span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500 text-white text-[10px] font-black">
                {compliance.healthGrade || 'A+'}
              </span>
            </div>

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
      )}

      {/* SECTION 1: OVERVIEW (KPIs + Latency Waves Chart + OutageTracker) */}
      {(activeReportTab === 'all' || activeReportTab === 'overview') && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <ReportKpiGrid
            metrics={metrics}
            compliance={compliance}
            flappingDevices={flappingDevices}
          />

          {/* Latency & Packet Loss Timeline */}
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
                    <YAxis
                      yAxisId="left"
                      stroke="#10b981"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => `${val}ms`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#f43f5e"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
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
                        name === 'latency' ? 'Roundtrip Latency' : 'Packet Loss'
                      ]}
                      labelFormatter={(lbl) => `Time: ${lbl}`}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="latency"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#reportLatencyGrad)"
                      connectNulls={true}
                      dot={{ r: 2.5, fill: '#10b981' }}
                      activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="packetLoss"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#reportLossGrad)"
                      connectNulls={true}
                      dot={{ r: 2.5, fill: '#f43f5e' }}
                      activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
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

          {/* Outage Tracker Live Engine */}
          <OutageTrackerWidget />
        </div>
      )}

      {/* SECTION 2: OUTAGE INCIDENT AUDITS */}
      {(activeReportTab === 'all' || activeReportTab === 'incidents') && (
        <IncidentAuditTable incidents={incidents} />
      )}

      {/* SECTION 3: COMPLIANCE & NOC AUDIT CHECKLIST */}
      {(activeReportTab === 'all' || activeReportTab === 'compliance') && (
        <ComplianceAuditTab
          metrics={metrics}
          compliance={compliance}
          branding={branding}
          incidents={incidents}
        />
      )}

      {/* SECTION 4: DEVICE INVENTORY & SLA MATRIX */}
      {(activeReportTab === 'all' || activeReportTab === 'devices') && selectedDeviceId === 'all' && deviceSummaries.length > 0 && (
        <DeviceSlaMatrixTable
          deviceSummaries={deviceSummaries}
          onSelectDevice={setSelectedDeviceId}
          filterDays={filter.days}
        />
      )}

      {/* Scheduled Automated Email Configuration Modal */}
      <ScheduledEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
    </div>
  );
}
