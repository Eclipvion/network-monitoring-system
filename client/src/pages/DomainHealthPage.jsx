import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Clock,
  Activity,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Zap,
  Server,
  Play,
  Pause,
  ArrowUpRight,
  Eye,
  HelpCircle,
  Info,
  X,
  FileText,
  ChevronDown,
  ChevronUp
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

export default function DomainHealthPage({ devices = [] }) {
  // Domain data states
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState(null);

  // Filters & View modes
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'HEALTHY' | 'EXPIRING_SSL' | 'EXPIRING_DOMAIN' | 'DOWN' | 'PAUSED'
  const [sortBy, setSortBy] = useState('sslExpiry'); // 'sslExpiry' | 'domainExpiry' | 'name' | 'latency'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modal 1: Add Monitored Domain
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newInterval, setNewInterval] = useState(3600);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // Modal 2: Domain Deep-Dive & Inspection Modal
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [domainHistory, setDomainHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('overview'); // 'overview' | 'whois' | 'dns' | 'latency'
  const [showRawWhois, setShowRawWhois] = useState(false);

  // Quick Ad-hoc Instant Lookup Bar
  const [showQuickProbe, setShowQuickProbe] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState(null);
  const [quickError, setQuickError] = useState(null);

  // Copy indicators
  const [copiedText, setCopiedText] = useState(null);

  const handleCopy = (text, e) => {
    e?.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Fetch all domains
  const fetchDomains = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getDomains();
      setDomains(data || []);
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  // Action: Check Single Domain Now
  const handleCheckNow = async (domainId, e) => {
    e?.stopPropagation();
    setCheckingId(domainId);
    try {
      const res = await api.checkDomainNow(domainId);
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, latestResult: res, healthStatus: res.sslValid && res.dnsResolved && (!res.httpStatus || res.httpStatus < 400) ? 'UP' : 'WARNING' } : d))
      );
      if (selectedDomain?.id === domainId) {
        setSelectedDomain((prev) => ({ ...prev, latestResult: res }));
        loadDomainHistory(domainId);
      }
    } catch (err) {
      alert(`Error checking domain: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  // Action: Check All Domains (Fleet Audit)
  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const res = await api.checkAllDomains();
      if (res.domains) {
        setDomains(res.domains);
        if (selectedDomain) {
          const fresh = res.domains.find((d) => d.id === selectedDomain.id);
          if (fresh) setSelectedDomain(fresh);
        }
      } else {
        await fetchDomains(true);
      }
    } catch (err) {
      alert(`Fleet check failed: ${err.message}`);
    } finally {
      setCheckingAll(false);
    }
  };

  // Action: Toggle Monitoring (Pause / Resume)
  const handleToggleMonitoring = async (domain, e) => {
    e?.stopPropagation();
    const nextStatus = !domain.monitoring;
    try {
      await api.updateDomain(domain.id, { monitoring: nextStatus });
      setDomains((prev) =>
        prev.map((d) => (d.id === domain.id ? { ...d, monitoring: nextStatus, healthStatus: nextStatus ? 'PENDING' : 'PAUSED' } : d))
      );
    } catch (err) {
      alert(`Failed to update monitoring state: ${err.message}`);
    }
  };

  // Action: Delete Domain
  const handleDeleteDomain = async (domain, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove "${domain.domain}" from domain health monitoring?`)) {
      return;
    }
    try {
      await api.deleteDomain(domain.id);
      setDomains((prev) => prev.filter((d) => d.id !== domain.id));
      if (selectedDomain?.id === domain.id) {
        setSelectedDomain(null);
      }
    } catch (err) {
      alert(`Failed to delete domain: ${err.message}`);
    }
  };

  // Action: Add Domain
  const handleAddDomain = async (e) => {
    e?.preventDefault();
    if (!newDomainInput.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const created = await api.addDomain({
        domain: newDomainInput.trim(),
        interval: Number(newInterval) || 3600,
        monitoring: true
      });
      setDomains((prev) => [...prev, created]);
      setNewDomainInput('');
      setIsAddModalOpen(false);
      // Trigger instant check
      if (created.id) {
        handleCheckNow(created.id);
      }
    } catch (err) {
      setAddError(err.message || 'Failed to add domain');
    } finally {
      setAddLoading(false);
    }
  };

  // Action: Open Domain Deep-Dive Modal
  const openDomainModal = async (domain) => {
    setSelectedDomain(domain);
    setActiveModalTab('overview');
    setShowRawWhois(false);
    loadDomainHistory(domain.id);
  };

  const loadDomainHistory = async (domainId) => {
    setHistoryLoading(true);
    try {
      const history = await api.getDomainHistory(domainId, 60);
      setDomainHistory(history || []);
    } catch (err) {
      console.warn('Failed to load history:', err);
      setDomainHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Action: Quick Ad-Hoc Probe
  const handleQuickProbe = async (e) => {
    e?.preventDefault();
    if (!quickInput.trim()) return;
    setQuickLoading(true);
    setQuickError(null);
    setQuickResult(null);
    try {
      const result = await api.quickProbeDomain(quickInput.trim());
      setQuickResult(result);
    } catch (err) {
      setQuickError(err.message || 'Quick probe failed');
    } finally {
      setQuickLoading(false);
    }
  };

  // Convert quick probe target to monitored domain
  const handleAddQuickToWatchlist = async () => {
    if (!quickResult?.domain) return;
    try {
      const created = await api.addDomain({
        domain: quickResult.domain,
        interval: 3600,
        monitoring: true
      });
      setDomains((prev) => [...prev, created]);
      setShowQuickProbe(false);
      setQuickResult(null);
      setQuickInput('');
      handleCheckNow(created.id);
    } catch (err) {
      alert(`Error saving to watchlist: ${err.message}`);
    }
  };

  // Helper date formatter
  const formatDateStr = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // KPI Calculations
  const totalCount = domains.length;
  const activeMonitored = domains.filter((d) => d.monitoring !== false).length;

  const validSslCount = domains.filter((d) => {
    const r = d.latestResult;
    return r && r.sslValid && r.sslDaysRemaining !== null && r.sslDaysRemaining > 30;
  }).length;

  const expiringSslSoonCount = domains.filter((d) => {
    const r = d.latestResult;
    return r && r.sslValid && r.sslDaysRemaining !== null && r.sslDaysRemaining <= 30 && r.sslDaysRemaining > 0;
  }).length;

  const expiredOrInvalidCount = domains.filter((d) => {
    const r = d.latestResult;
    return r && (r.sslValid === false || (r.sslDaysRemaining !== null && r.sslDaysRemaining <= 0));
  }).length;

  const resolvedDnsCount = domains.filter((d) => d.latestResult?.dnsResolved).length;

  const responseTimeItems = domains
    .map((d) => d.latestResult?.responseTimeMs)
    .filter((ms) => typeof ms === 'number' && ms > 0);
  const avgLatency = responseTimeItems.length > 0
    ? Math.round(responseTimeItems.reduce((a, b) => a + b, 0) / responseTimeItems.length)
    : null;

  // Filter & Sort
  const filteredDomains = useMemo(() => {
    return domains
      .filter((d) => {
        const matchesSearch =
          d.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (d.latestResult?.resolvedIp && d.latestResult.resolvedIp.includes(searchTerm)) ||
          (d.latestResult?.domainRegistrar && d.latestResult.domainRegistrar.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (d.latestResult?.sslIssuer && d.latestResult.sslIssuer.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        const isPaused = !d.monitoring;
        const res = d.latestResult;
        const sslDays = res?.sslDaysRemaining ?? null;
        const domainDays = res?.domainDaysRemaining ?? null;

        const isSslExpiring = sslDays !== null && sslDays <= 30 && sslDays > 0;
        const isDomainExpiring = domainDays !== null && domainDays <= 60 && domainDays > 0;
        const isDown = !res?.dnsResolved || (res?.httpStatus && res.httpStatus >= 500) || sslDays === 0 || res?.sslValid === false;
        const isHealthy = !isPaused && !isDown && !isSslExpiring && res !== null;

        if (statusFilter === 'HEALTHY') return isHealthy;
        if (statusFilter === 'EXPIRING_SSL') return isSslExpiring;
        if (statusFilter === 'EXPIRING_DOMAIN') return isDomainExpiring;
        if (statusFilter === 'DOWN') return isDown;
        if (statusFilter === 'PAUSED') return isPaused;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.domain.localeCompare(b.domain);
        }
        if (sortBy === 'latency') {
          const latA = a.latestResult?.responseTimeMs ?? 99999;
          const latB = b.latestResult?.responseTimeMs ?? 99999;
          return latA - latB;
        }
        if (sortBy === 'domainExpiry') {
          const daysA = a.latestResult?.domainDaysRemaining ?? 99999;
          const daysB = b.latestResult?.domainDaysRemaining ?? 99999;
          return daysA - daysB;
        }
        // default: SSL expiry days soonest first
        const daysA = a.latestResult?.sslDaysRemaining ?? 9999;
        const daysB = b.latestResult?.sslDaysRemaining ?? 9999;
        return daysA - daysB;
      });
  }, [domains, searchTerm, statusFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Domains Card */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Monitored Domains
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400">
              ({activeMonitored} active)
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {resolvedDnsCount} of {totalCount} resolving IPv4 DNS correctly
          </p>
        </div>

        {/* SSL Security Health */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              SSL / HTTPS Security
            </span>
            <div className={`p-2 rounded-xl ${
              expiredOrInvalidCount > 0
                ? 'bg-rose-500/10 text-rose-500 animate-pulse'
                : expiringSslSoonCount > 0
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {expiredOrInvalidCount > 0 ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-500">
              {validSslCount}
            </span>
            <span className="text-xs text-slate-400">Valid</span>
            {expiringSslSoonCount > 0 && (
              <span className="ml-auto text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {expiringSslSoonCount} SSL Expiring Soon
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {expiredOrInvalidCount > 0 ? (
              <span className="text-rose-500 font-semibold">{expiredOrInvalidCount} expired or invalid certificate(s)!</span>
            ) : expiringSslSoonCount > 0 ? (
              <span className="text-amber-500 font-medium">{expiringSslSoonCount} cert(s) expire within 30 days</span>
            ) : (
              'All monitored certificates healthy & valid'
            )}
          </p>
        </div>

        {/* Web HTTP Response Latency */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Web Response Latency
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {avgLatency !== null ? `${avgLatency} ms` : 'N/A'}
            </span>
            <span className="text-xs text-slate-400">avg HTTP time</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Measured via real-time TLS handshake & HTTP GET
          </p>
        </div>

        {/* DNS & Fleet Posture */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fleet Health Status
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${
              expiredOrInvalidCount > 0 ? 'text-rose-500' : expiringSslSoonCount > 0 ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              {expiredOrInvalidCount > 0 ? 'ATTENTION' : expiringSslSoonCount > 0 ? 'WARNING' : 'OPERATIONAL'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {totalCount > 0 ? `${Math.round(((totalCount - expiredOrInvalidCount) / totalCount) * 100)}% endpoints healthy` : 'No domains'}
          </p>
        </div>
      </div>

      {/* Action Bar & Quick Probe Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Domain</span>
          </button>

          <button
            onClick={handleCheckAll}
            disabled={checkingAll || totalCount === 0}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingAll ? 'animate-spin text-emerald-500' : ''}`} />
            <span>{checkingAll ? 'Auditing Fleet...' : 'Audit All Now'}</span>
          </button>

          <button
            onClick={() => setShowQuickProbe(!showQuickProbe)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              showQuickProbe
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Instant Domain & WHOIS Lookup</span>
          </button>
        </div>

        {/* View Switcher: Cards vs Table */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Grid Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Data Table
          </button>
        </div>
      </div>

      {/* Quick Ad-Hoc Instant Lookup Banner */}
      {showQuickProbe && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-500/30 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Built-in Domain WHOIS & SSL Certificate Lookup
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect any domain's registration dates (Created / Expires) and SSL certificate inside this app with zero external redirects.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowQuickProbe(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleQuickProbe} className="flex flex-wrap items-center gap-2 max-w-xl">
            <div className="relative flex-1 min-w-[240px]">
              <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Enter domain name (e.g. facebook.com, google.com, github.com)..."
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={quickLoading || !quickInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 ${quickLoading ? 'animate-spin' : ''}`} />
              <span>{quickLoading ? 'Querying...' : 'Query Live'}</span>
            </button>
          </form>

          {quickError && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{quickError}</span>
            </div>
          )}

          {quickResult && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {quickResult.domain}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                    quickResult.sslValid
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  }`}>
                    {quickResult.sslValid ? 'SSL Valid' : 'SSL Invalid'}
                  </span>
                </div>
                <button
                  onClick={handleAddQuickToWatchlist}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Monitored Domains</span>
                </button>
              </div>

              {/* Both Dates Side By Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. Domain Registration WHOIS */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 text-xs">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Domain Registration (WHOIS)</span>
                  </span>
                  <div className="space-y-1 pt-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Created:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateStr(quickResult.domainCreated)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Updated:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateStr(quickResult.domainUpdated)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expires:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatDateStr(quickResult.domainExpires)} {quickResult.domainDaysRemaining !== null && `(${quickResult.domainDaysRemaining}d)`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Registrar:</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[170px]">{quickResult.domainRegistrar || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. SSL Certificate HTTPS */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>SSL Certificate (HTTPS Web Security)</span>
                  </span>
                  <div className="space-y-1 pt-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">SSL Expires:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatDateStr(quickResult.sslExpiresAt)} ({quickResult.sslDaysRemaining ?? 'N/A'} days)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Issuer CA:</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[170px]">{quickResult.sslIssuer || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">HTTP Status:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {quickResult.httpStatus ? `${quickResult.httpStatus} OK (${quickResult.responseTimeMs}ms)` : 'No HTTP'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Resolved IP:</span>
                      <span className="text-slate-700 dark:text-slate-300">{quickResult.resolvedIp || 'Unresolved'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search domain name, IP, registrar, or issuer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="ALL">All Status ({domains.length})</option>
            <option value="HEALTHY">Healthy & Valid ({validSslCount})</option>
            <option value="EXPIRING_SSL">SSL Expiring Soon (≤30d)</option>
            <option value="DOWN">Down / Invalid</option>
            <option value="PAUSED">Paused ({domains.length - activeMonitored})</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 hidden sm:block"
          >
            <option value="sslExpiry">Sort: SSL Expiry Days</option>
            <option value="domainExpiry">Sort: Domain Reg. Expiry</option>
            <option value="name">Sort: Domain Name</option>
            <option value="latency">Sort: Fastest Latency</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <strong>{filteredDomains.length}</strong> of {domains.length} monitored domains
        </div>
      </div>

      {/* Empty State */}
      {filteredDomains.length === 0 && !loading && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-base text-slate-900 dark:text-white">
            {searchTerm || statusFilter !== 'ALL' ? 'No Matching Domains Found' : 'No Domains Monitored Yet'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter to see other domains.'
              : 'Add your business websites, public APIs, client domains, or internal web portals to monitor WHOIS registration and SSL expiry 24/7.'}
          </p>
          {!searchTerm && statusFilter === 'ALL' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Domain</span>
            </button>
          )}
        </div>
      )}

      {/* VIEW MODE 1: Grid Cards */}
      {viewMode === 'cards' && filteredDomains.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDomains.map((item) => {
            const isPaused = !item.monitoring;
            const res = item.latestResult;
            const sslDays = res?.sslDaysRemaining ?? null;
            const domainDays = res?.domainDaysRemaining ?? null;
            const isChecking = checkingId === item.id;

            let statusColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            let statusText = 'HEALTHY';

            if (isPaused) {
              statusColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700';
              statusText = 'PAUSED';
            } else if (!res) {
              statusColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
              statusText = 'PENDING CHECK';
            } else if (!res.dnsResolved || (res.httpStatus && res.httpStatus >= 500) || res.sslValid === false || (sslDays !== null && sslDays <= 0)) {
              statusColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
              statusText = !res.dnsResolved ? 'DNS FAILED' : sslDays === 0 ? 'SSL EXPIRED' : 'DOWN';
            } else if (sslDays !== null && sslDays <= 30) {
              statusColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
              statusText = 'SSL EXPIRING SOON';
            }

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all space-y-3.5 shadow-sm bg-white dark:bg-slate-900 ${
                  statusText === 'SSL EXPIRING SOON'
                    ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                    : statusText === 'DOWN' || statusText === 'SSL EXPIRED'
                    ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {item.domain}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <span>IP: {res?.resolvedIp || 'Unresolved'}</span>
                      {res?.resolvedIp && (
                        <button
                          onClick={(e) => handleCopy(res.resolvedIp, e)}
                          title="Copy IP"
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        >
                          {copiedText === res.resolvedIp ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border shrink-0 ${statusColor}`}>
                    {statusText}
                  </span>
                </div>

                {/* 1. DOMAIN REGISTRATION EXPIRES (WHOIS) */}
                <div className="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Domain Reg. (WHOIS)</span>
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {domainDays !== null ? `${domainDays} days left` : 'Queried'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="truncate max-w-[150px]">{res?.domainRegistrar || 'Registrar N/A'}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Expires: {formatDateStr(res?.domainExpires)}
                    </span>
                  </div>
                </div>

                {/* 2. SSL CERTIFICATE EXPIRES (HTTPS) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>SSL Security (HTTPS)</span>
                    </span>
                    <span className={`font-mono font-bold ${
                      sslDays !== null && sslDays <= 7
                        ? 'text-rose-500'
                        : sslDays !== null && sslDays <= 30
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}>
                      {sslDays !== null ? `${sslDays} days left` : 'No data'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="truncate max-w-[150px]">{res?.sslIssuer || 'Issuer N/A'}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Expires: {formatDateStr(res?.sslExpiresAt)}
                    </span>
                  </div>
                </div>

                {/* HTTP Status & Latency Badges */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">HTTP:</span>
                    <span className={`font-mono font-bold ${
                      res?.httpStatus && res.httpStatus < 400
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500'
                    }`}>
                      {res?.httpStatus ? `${res.httpStatus} OK` : 'Down'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Latency:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {res?.responseTimeMs ? `${res.responseTimeMs}ms` : '—'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openDomainModal(item)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Records</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleCheckNow(item.id, e)}
                      disabled={isChecking}
                      title="Run live probe now"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-500' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => handleToggleMonitoring(item, e)}
                      title={item.monitoring ? 'Pause monitoring' : 'Resume monitoring'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    >
                      {item.monitoring ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={(e) => handleDeleteDomain(item, e)}
                      title="Delete domain"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Enterprise Data Table */}
      {viewMode === 'table' && filteredDomains.length > 0 && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Domain Name</th>
                  <th className="py-3.5 px-4">Domain Expires (WHOIS)</th>
                  <th className="py-3.5 px-4">Registrar</th>
                  <th className="py-3.5 px-4">SSL Expires (HTTPS)</th>
                  <th className="py-3.5 px-4">SSL Issuer</th>
                  <th className="py-3.5 px-4">HTTP Status</th>
                  <th className="py-3.5 px-4">Latency</th>
                  <th className="py-3.5 px-4">Resolved IP</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredDomains.map((item) => {
                  const res = item.latestResult;
                  const sslDays = res?.sslDaysRemaining ?? null;
                  const domainDays = res?.domainDaysRemaining ?? null;
                  const isChecking = checkingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => openDomainModal(item)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <span>{item.domain}</span>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {formatDateStr(res?.domainExpires)}
                        </span>
                        {domainDays !== null && (
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {domainDays} days left
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                        {res?.domainRegistrar || '—'}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className={`font-bold ${
                          sslDays !== null && sslDays <= 7 ? 'text-rose-500' : sslDays !== null && sslDays <= 30 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {formatDateStr(res?.sslExpiresAt)}
                        </span>
                        {sslDays !== null && (
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {sslDays} days left
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                        {res?.sslIssuer || '—'}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {res?.httpStatus ? (
                          <span className={res.httpStatus < 400 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                            {res.httpStatus} OK
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {res?.responseTimeMs ? `${res.responseTimeMs} ms` : '—'}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {res?.resolvedIp || '—'}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleCheckNow(item.id, e)}
                            disabled={isChecking}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-500' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteDomain(item, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL 1: Add Monitored Domain */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Add Monitored Domain
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track WHOIS expiration, SSL certs, and DNS health.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDomain} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Domain Name or FQDN *
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. google.com, facebook.com, custom-domain.com"
                    value={newDomainInput}
                    onChange={(e) => setNewDomainInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Protocol prefixes ("https://") will be automatically sanitized.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Audit Check Frequency
                </label>
                <select
                  value={newInterval}
                  onChange={(e) => setNewInterval(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value={900}>Every 15 Minutes (High Priority)</option>
                  <option value={3600}>Every 1 Hour (Standard)</option>
                  <option value={21600}>Every 6 Hours</option>
                  <option value={86400}>Every 24 Hours (Daily Audit)</option>
                </select>
              </div>

              {addError && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs">
                  {addError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !newDomainInput.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{addLoading ? 'Adding...' : 'Add Domain'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 100% NATIVE DOMAIN & WHOIS INSPECTOR (NO EXTERNAL REDIRECTS) */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {selectedDomain.domain}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Resolved IP: {selectedDomain.latestResult?.resolvedIp || 'Unresolved'} • Last Queried: {selectedDomain.latestResult?.timestamp ? new Date(selectedDomain.latestResult.timestamp).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCheckNow(selectedDomain.id)}
                  disabled={checkingId === selectedDomain.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingId === selectedDomain.id ? 'animate-spin text-emerald-500' : ''}`} />
                  <span>Refresh Now</span>
                </button>
                <button
                  onClick={() => setSelectedDomain(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Overview & Dates | Built-In WHOIS | Built-In DNS | Latency History */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeModalTab === 'overview'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Key Expiry Dates & SSL
              </button>
              <button
                onClick={() => setActiveModalTab('whois')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeModalTab === 'whois'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Built-in WHOIS Records
              </button>
              <button
                onClick={() => setActiveModalTab('dns')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeModalTab === 'dns'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                DNS (A / NS / MX)
              </button>
              <button
                onClick={() => setActiveModalTab('latency')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeModalTab === 'latency'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Latency Telemetry
              </button>
            </div>

            {/* TAB 1: OVERVIEW & BOTH EXPIRATION DATES SIDE-BY-SIDE */}
            {activeModalTab === 'overview' && (
              <div className="space-y-4">
                {/* Visual Explanation Banner */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Info className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Understanding Domain Registration vs SSL Certificate Dates</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    A website has <strong>two separate expirations</strong>: The <strong>Domain Name Registration</strong> (WHOIS, renews every 5-10 years with your domain registrar) and the <strong>SSL/TLS Certificate</strong> (HTTPS padlock security, renews every 90 days to 1 year on your web server). Both are tracked below:
                  </p>
                </div>

                {/* 2 Big Comparison Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card A: Domain Registration WHOIS */}
                  <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Globe className="w-4 h-4" />
                        <span>Domain Registration (WHOIS)</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        {selectedDomain.latestResult?.domainDaysRemaining !== null ? `${selectedDomain.latestResult.domainDaysRemaining} Days Left` : 'Active'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Expires On:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {formatDateStr(selectedDomain.latestResult?.domainExpires)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Created On:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {formatDateStr(selectedDomain.latestResult?.domainCreated)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Last Updated:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {formatDateStr(selectedDomain.latestResult?.domainUpdated)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Registrar:</span>
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                          {selectedDomain.latestResult?.domainRegistrar || 'Unknown Registrar'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card B: SSL / TLS Security Certificate */}
                  <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Lock className="w-4 h-4" />
                        <span>SSL Certificate (HTTPS Web)</span>
                      </span>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        selectedDomain.latestResult?.sslDaysRemaining !== null && selectedDomain.latestResult.sslDaysRemaining <= 7
                          ? 'bg-rose-500/15 text-rose-500'
                          : selectedDomain.latestResult?.sslDaysRemaining !== null && selectedDomain.latestResult.sslDaysRemaining <= 30
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-emerald-500/15 text-emerald-500'
                      }`}>
                        {selectedDomain.latestResult?.sslDaysRemaining !== null ? `${selectedDomain.latestResult.sslDaysRemaining} Days Left` : 'Active'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">SSL Expires:</span>
                        <span className={`font-bold ${
                          selectedDomain.latestResult?.sslDaysRemaining !== null && selectedDomain.latestResult.sslDaysRemaining <= 30
                            ? 'text-amber-500'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {formatDateStr(selectedDomain.latestResult?.sslExpiresAt)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Issuer CA:</span>
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                          {selectedDomain.latestResult?.sslIssuer || 'Unknown CA'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Security Protocol:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {selectedDomain.latestResult?.sslProtocol || 'TLS 1.3 / 1.2'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <span className="text-slate-400 font-sans">HTTP Response:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {selectedDomain.latestResult?.httpStatus ? `${selectedDomain.latestResult.httpStatus} OK (${selectedDomain.latestResult.responseTimeMs}ms)` : 'Unreachable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BUILT-IN WHOIS RECORDS (NATIVE - NO EXTERNAL REDIRECTS) */}
            {activeModalTab === 'whois' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Authoritative Registry WHOIS Data for {selectedDomain.domain}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Queried via TCP Port 43</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-sans">Created Date</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {formatDateStr(selectedDomain.latestResult?.domainCreated)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-sans">Updated Date</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {formatDateStr(selectedDomain.latestResult?.domainUpdated)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-sans">Registry Expiration</span>
                    <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                      {formatDateStr(selectedDomain.latestResult?.domainExpires)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-sans">Registrar</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {selectedDomain.latestResult?.domainRegistrar || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Raw WHOIS Text Expansion */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowRawWhois(!showRawWhois)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline cursor-pointer"
                  >
                    <span>{showRawWhois ? 'Hide Raw Registry WHOIS Output' : 'View Full Raw Registry WHOIS Output'}</span>
                    {showRawWhois ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showRawWhois && (
                    <div className="relative">
                      <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-64 leading-relaxed border border-slate-800 select-all">
                        {selectedDomain.latestResult?.whoisRaw || 'No raw WHOIS text available for this domain.'}
                      </pre>
                      {selectedDomain.latestResult?.whoisRaw && (
                        <button
                          onClick={(e) => handleCopy(selectedDomain.latestResult.whoisRaw, e)}
                          className="absolute right-3 top-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                        >
                          {copiedText === selectedDomain.latestResult.whoisRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedText === selectedDomain.latestResult.whoisRaw ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: BUILT-IN DNS RECORDS (A / NS / MX) */}
            {activeModalTab === 'dns' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* A Records */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      IPv4 Addresses (A Records)
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {selectedDomain.latestResult?.allIps?.length > 0 ? (
                        selectedDomain.latestResult.allIps.map((ip) => (
                          <div key={ip} className="flex items-center justify-between py-0.5">
                            <span className="text-emerald-600 dark:text-emerald-400">{ip}</span>
                            <button
                              onClick={(e) => handleCopy(ip, e)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400">{selectedDomain.latestResult?.resolvedIp || 'No A records'}</span>
                      )}
                    </div>
                  </div>

                  {/* Name Servers (NS) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Authoritative Nameservers (NS)
                    </span>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {selectedDomain.latestResult?.nameServers?.length > 0 ? (
                        selectedDomain.latestResult.nameServers.map((ns) => (
                          <div key={ns} className="truncate" title={ns}>{ns}</div>
                        ))
                      ) : (
                        <span className="text-slate-400">Standard root nameservers</span>
                      )}
                    </div>
                  </div>

                  {/* Mail Servers (MX) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Mail Exchange Servers (MX)
                    </span>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {selectedDomain.latestResult?.mailServers?.length > 0 ? (
                        selectedDomain.latestResult.mailServers.map((mx) => (
                          <div key={mx} className="truncate" title={mx}>{mx}</div>
                        ))
                      ) : (
                        <span className="text-slate-400">No MX mail servers</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: RESPONSE TIME TELEMETRY GRAPH */}
            {activeModalTab === 'latency' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    HTTP Roundtrip Latency History (ms)
                  </h4>
                  {historyLoading && <span className="text-[11px] text-slate-400">Loading history...</span>}
                </div>

                <div className="h-52 w-full bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {domainHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={domainHistory}>
                        <defs>
                          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          fontSize={10}
                          stroke="#94a3b8"
                        />
                        <YAxis fontSize={10} stroke="#94a3b8" unit="ms" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                          labelFormatter={(t) => new Date(t).toLocaleString()}
                          formatter={(val) => [`${val} ms`, 'Response Time']}
                        />
                        <Area type="monotone" dataKey="responseTimeMs" stroke="#10b981" strokeWidth={2} fill="url(#latencyGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No historical samples captured yet. Run periodic audits to build trend lines.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
