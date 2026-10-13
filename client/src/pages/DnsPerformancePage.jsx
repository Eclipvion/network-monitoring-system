import React, { useState, useEffect } from 'react';
import {
  Globe,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Award,
  RefreshCw,
  Search,
  Check,
  Copy,
  Download,
  ExternalLink,
  ChevronRight,
  Sliders,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Server,
  Layers,
  ArrowUpDown,
  Laptop,
  Wifi,
  Terminal,
  Activity,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import api from '../services/api';

export default function DnsPerformancePage() {
  const [domainInput, setDomainInput] = useState('google.com');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('fastest'); // 'fastest' | 'slowest' | 'name' | 'diff'
  const [hideOffline, setHideOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [error, setError] = useState(null);

  // Copied IP state tracker
  const [copiedIp, setCopiedIp] = useState(null);
  const [copiedFlush, setCopiedFlush] = useState(false);

  // Setup instructions modal
  const [setupResolver, setSetupResolver] = useState(null);
  const [setupOsTab, setSetupOsTab] = useState('windows'); // 'windows' | 'router' | 'macos'

  // Quick domain chips
  const popularDomains = ['google.com', 'cloudflare.com', 'wikipedia.org', 'github.com', 'microsoft.com'];

  // Categories list
  const categories = [
    { id: 'all', label: 'All Resolvers (40+)', icon: Layers },
    { id: 'fastest', label: 'Ultra-Fast Anycast', icon: Zap },
    { id: 'security', label: 'Threat Protection', icon: ShieldCheck },
    { id: 'adblock', label: 'Ad & Tracker Block', icon: ShieldAlert },
    { id: 'privacy', label: 'Zero-Logs Privacy', icon: Award },
    { id: 'family', label: 'Family Shield', icon: CheckCircle2 },
    { id: 'regional', label: 'Regional Backbone', icon: Globe }
  ];

  // Run full benchmark
  const runBenchmark = async (targetDomain = domainInput, cat = selectedCategory) => {
    const cleanDomain = (targetDomain || 'google.com').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    setLoading(true);
    setError(null);
    try {
      const data = await api.runFullDnsBenchmark({
        domain: cleanDomain,
        category: cat,
        timeoutMs: 2500
      });
      setBenchmarkData(data);
    } catch (err) {
      setError(err.message || 'DNS Speed Benchmark failed to execute');
    } finally {
      setLoading(false);
    }
  };

  // Run on first load
  useEffect(() => {
    runBenchmark();
  }, []);

  // Copy IP to clipboard
  const handleCopyIp = (ip, label) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(`${label}-${ip}`);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // 1-Click Copy Flush DNS
  const handleCopyFlushDns = () => {
    navigator.clipboard.writeText('ipconfig /flushdns');
    setCopiedFlush(true);
    setTimeout(() => setCopiedFlush(false), 2200);
  };

  // Export results as CSV
  const handleExportCsv = () => {
    if (!benchmarkData?.resolvers) return;
    const headers = ['Rank', 'Name', 'Provider', 'Primary IP', 'Secondary IP', 'Category', 'Latency (ms)', 'Difference (ms)', 'Status', 'Features'];
    const rows = benchmarkData.resolvers.map((r) => [
      r.rank || '—',
      `"${r.name}"`,
      `"${r.provider}"`,
      r.ip,
      r.secondaryIp || '',
      r.category,
      r.latencyMs ?? 'Timeout',
      r.diffFromFastest !== null ? `+${r.diffFromFastest}` : '—',
      r.status,
      `"${(r.features || []).join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dns-speedtest-benchmark-${domainInput}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export results as JSON
  const handleExportJson = () => {
    if (!benchmarkData) return;
    const jsonStr = JSON.stringify(benchmarkData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dns-benchmark-${domainInput}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and Sort resolvers for table display
  let filteredResolvers = (benchmarkData?.resolvers || []).filter((r) => {
    const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ip.includes(searchQuery) ||
      (r.features || []).some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesOffline = !hideOffline || r.status === 'UP';
    return matchesCategory && matchesSearch && matchesOffline;
  });

  // Apply sorting
  filteredResolvers = [...filteredResolvers].sort((a, b) => {
    if (sortBy === 'fastest') {
      return (a.latencyMs || 9999) - (b.latencyMs || 9999);
    }
    if (sortBy === 'slowest') {
      return (b.latencyMs || 0) - (a.latencyMs || 0);
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'diff') {
      return (a.diffFromFastest ?? 9999) - (b.diffFromFastest ?? 9999);
    }
    return 0;
  });

  // Top 14 for Chart
  const chartData = (benchmarkData?.resolvers || [])
    .filter((r) => r.status === 'UP' && r.latencyMs !== null)
    .slice(0, 14)
    .map((r) => ({
      name: r.name.replace(/ \(Primary\)|\(Home\)/, ''),
      latency: r.latencyMs,
      provider: r.provider,
      rank: r.rank
    }));

  const fastestLatency = benchmarkData?.stats?.minLatency || 20;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-emerald-950/40 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Globe className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Global 40+ Resolvers Benchmark Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              DNS Speed Test & Nearest Server Finder
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Real-time multi-threaded DNS speed benchmark inspired by dnsspeedtest.online. We test 40+ major global, privacy, and ad-blocking DNS providers simultaneously from your network to identify the fastest and closest nameservers for lowest latency.
            </p>
          </div>

          {/* Action Triggers */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => runBenchmark()}
              disabled={loading}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Racing 40+ Resolvers...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Start Speed Benchmark</span>
                </>
              )}
            </button>

            {benchmarkData && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCsv}
                  className="px-3.5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                  title="Download CSV benchmark report"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleExportJson}
                  className="px-3.5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                  title="Download JSON benchmark report"
                >
                  <FileJson className="w-4 h-4" />
                  <span>JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Target Domain Input & Quick Pills */}
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Test Query Domain:</span>
            {popularDomains.map((dom) => (
              <button
                key={dom}
                onClick={() => {
                  setDomainInput(dom);
                  runBenchmark(dom);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-medium transition-all ${
                  domainInput === dom
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="custom domain (e.g. reddit.com)..."
              className="px-3.5 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full md:w-56"
            />
            <button
              onClick={() => runBenchmark(domainInput)}
              disabled={loading || !domainInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-medium disabled:opacity-50"
            >
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Current System DNS Active Status Card */}
      {benchmarkData?.currentSystemDns && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              benchmarkData.currentSystemDns.isFastest
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-indigo-500/10 text-indigo-500'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Your Current System DNS:
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  {benchmarkData.currentSystemDns.ip}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {benchmarkData.currentSystemDns.name} • {benchmarkData.currentSystemDns.latencyMs ? `${benchmarkData.currentSystemDns.latencyMs}ms latency` : 'Active'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {benchmarkData.currentSystemDns.isFastest
                  ? '🎉 Great news! Your computer is already utilizing the fastest detected DNS server.'
                  : benchmarkData.currentSystemDns.speedDiffPercent > 0
                  ? `Switching to ${benchmarkData.recommendations?.fastestOverall?.name} could resolve domain queries ~${benchmarkData.currentSystemDns.speedDiffPercent}% faster.`
                  : 'System DNS successfully resolved test domain.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyFlushDns}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all flex items-center gap-1.5 shadow-sm"
              title="Copy 'ipconfig /flushdns' command to clear Windows DNS cache"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
              <span>{copiedFlush ? 'Command Copied!' : 'Flush DNS Cache'}</span>
            </button>

            {benchmarkData.recommendations?.fastestOverall && !benchmarkData.currentSystemDns.isFastest && (
              <button
                onClick={() => setSetupResolver(benchmarkData.recommendations.fastestOverall)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                Apply Fastest DNS
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Recommendations Podium (Like dnsspeedtest.online) */}
      {benchmarkData?.recommendations && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              <span>Recommended DNS Resolvers For Your Connection</span>
            </h3>
            {benchmarkData.benchmarkDurationMs && (
              <span className="text-[11px] text-slate-400 font-mono">
                Raced {benchmarkData.totalTested} servers in {benchmarkData.benchmarkDurationMs}ms
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Fastest Overall Winner */}
            {benchmarkData.recommendations.fastestOverall && (
              <div className="glass-panel p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04] space-y-4 relative overflow-hidden shadow-lg shadow-emerald-500/5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white flex items-center gap-1 shadow-sm">
                    <Zap className="w-3 h-3 fill-current" /> #1 Fastest (Lowest Ping)
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {benchmarkData.recommendations.fastestOverall.latencyMs}ms
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    {benchmarkData.recommendations.fastestOverall.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {benchmarkData.recommendations.fastestOverall.provider} • {benchmarkData.recommendations.fastestOverall.location}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono">Primary IP:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span>{benchmarkData.recommendations.fastestOverall.ip}</span>
                      <button
                        onClick={() => handleCopyIp(benchmarkData.recommendations.fastestOverall.ip, 'fast-p')}
                        className="p-1 hover:text-emerald-500 transition-colors"
                        title="Copy Primary IP"
                      >
                        {copiedIp === `fast-p-${benchmarkData.recommendations.fastestOverall.ip}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  {benchmarkData.recommendations.fastestOverall.secondaryIp && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Secondary IP:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{benchmarkData.recommendations.fastestOverall.secondaryIp}</span>
                        <button
                          onClick={() => handleCopyIp(benchmarkData.recommendations.fastestOverall.secondaryIp, 'fast-s')}
                          className="p-1 hover:text-emerald-500 transition-colors"
                          title="Copy Secondary IP"
                        >
                          {copiedIp === `fast-s-${benchmarkData.recommendations.fastestOverall.secondaryIp}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Best for gaming & lowest browsing lag
                  </span>
                  <button
                    onClick={() => setSetupResolver(benchmarkData.recommendations.fastestOverall)}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    Setup <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Best Security & Privacy Choice */}
            {benchmarkData.recommendations.fastestSecurity && (
              <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.03] space-y-4 shadow-lg shadow-indigo-500/5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500 text-white flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-3 h-3" /> Best Security Choice
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {benchmarkData.recommendations.fastestSecurity.latencyMs}ms
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    {benchmarkData.recommendations.fastestSecurity.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {benchmarkData.recommendations.fastestSecurity.provider} • Threat & Phishing Shield
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono">Primary IP:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span>{benchmarkData.recommendations.fastestSecurity.ip}</span>
                      <button
                        onClick={() => handleCopyIp(benchmarkData.recommendations.fastestSecurity.ip, 'sec-p')}
                        className="p-1 hover:text-indigo-500 transition-colors"
                      >
                        {copiedIp === `sec-p-${benchmarkData.recommendations.fastestSecurity.ip}` ? (
                          <Check className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  {benchmarkData.recommendations.fastestSecurity.secondaryIp && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Secondary IP:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{benchmarkData.recommendations.fastestSecurity.secondaryIp}</span>
                        <button
                          onClick={() => handleCopyIp(benchmarkData.recommendations.fastestSecurity.secondaryIp, 'sec-s')}
                          className="p-1 hover:text-indigo-500 transition-colors"
                        >
                          {copiedIp === `sec-s-${benchmarkData.recommendations.fastestSecurity.secondaryIp}` ? (
                            <Check className="w-3.5 h-3.5 text-indigo-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Blocks cyber threats & zero query logs
                  </span>
                  <button
                    onClick={() => setSetupResolver(benchmarkData.recommendations.fastestSecurity)}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    Setup <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 3. Best Ad-Blocker Choice */}
            {benchmarkData.recommendations.fastestAdBlock && (
              <div className="glass-panel p-5 rounded-2xl border border-rose-500/30 bg-rose-500/[0.02] dark:bg-rose-500/[0.03] space-y-4 shadow-lg shadow-rose-500/5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white flex items-center gap-1 shadow-sm">
                    <ShieldAlert className="w-3 h-3" /> Best Ad-Blocker Choice
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                      {benchmarkData.recommendations.fastestAdBlock.latencyMs}ms
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    {benchmarkData.recommendations.fastestAdBlock.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {benchmarkData.recommendations.fastestAdBlock.provider} • Network-wide Ad & Tracker Filter
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono">Primary IP:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span>{benchmarkData.recommendations.fastestAdBlock.ip}</span>
                      <button
                        onClick={() => handleCopyIp(benchmarkData.recommendations.fastestAdBlock.ip, 'ad-p')}
                        className="p-1 hover:text-rose-500 transition-colors"
                      >
                        {copiedIp === `ad-p-${benchmarkData.recommendations.fastestAdBlock.ip}` ? (
                          <Check className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  {benchmarkData.recommendations.fastestAdBlock.secondaryIp && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">Secondary IP:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{benchmarkData.recommendations.fastestAdBlock.secondaryIp}</span>
                        <button
                          onClick={() => handleCopyIp(benchmarkData.recommendations.fastestAdBlock.secondaryIp, 'ad-s')}
                          className="p-1 hover:text-rose-500 transition-colors"
                        >
                          {copiedIp === `ad-s-${benchmarkData.recommendations.fastestAdBlock.secondaryIp}` ? (
                            <Check className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    Blocks banners & telemetry across all devices
                  </span>
                  <button
                    onClick={() => setSetupResolver(benchmarkData.recommendations.fastestAdBlock)}
                    className="font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5"
                  >
                    Setup <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Latency Comparison Visual Chart */}
      {chartData.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart className="w-4 h-4 text-emerald-500" />
                <span>Top 14 Fastest Resolvers Speed Comparison (Latency ms)</span>
              </h3>
              <p className="text-xs text-slate-400">Lower response time (ms) indicates faster resolution and closer proximity.</p>
            </div>
            {benchmarkData?.stats?.avgLatency && (
              <span className="text-xs font-mono font-bold text-slate-500">
                Avg: {benchmarkData.stats.avgLatency}ms • Min: {benchmarkData.stats.minLatency}ms
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 10, fill: '#888888' }}
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#888888' }}
                  unit="ms"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900/90 backdrop-blur-md rounded-xl text-white text-xs border border-slate-700 shadow-xl space-y-1">
                          <p className="font-bold text-emerald-400">#{data.rank} {data.name}</p>
                          <p className="text-slate-300 font-mono">Provider: {data.provider}</p>
                          <p className="font-bold text-white font-mono text-sm">{data.latency} ms</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="latency" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => {
                    let color = '#10b981'; // Green < 35ms
                    if (entry.latency > 90) color = '#f43f5e'; // Red
                    else if (entry.latency > 60) color = '#f59e0b'; // Amber
                    else if (entry.latency > 35) color = '#06b6d4'; // Cyan
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Categories & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Controls Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, IP, tag..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
              >
                <option value="fastest">Fastest First (Lowest Latency)</option>
                <option value="slowest">Slowest First</option>
                <option value="diff">Difference (+ms vs #1)</option>
                <option value="name">Provider Name (A-Z)</option>
              </select>
            </div>

            {/* Hide Offline Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideOffline}
                onChange={(e) => setHideOffline(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500/40"
              />
              <span>Hide Timeouts</span>
            </label>
          </div>
        </div>
      </div>

      {/* 40+ Resolvers Comprehensive Ranked Table */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              All Benchmark Results
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Showing {filteredResolvers.length} of {benchmarkData?.totalTested || 41}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> &lt;35ms Fast
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> 35-90ms Normal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> &gt;90ms Slow
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-400">
                <th className="py-3 px-4 w-14 text-center">Rank</th>
                <th className="py-3 px-4">DNS Resolver / Provider</th>
                <th className="py-3 px-4">Primary IP</th>
                <th className="py-3 px-4">Secondary IP</th>
                <th className="py-3 px-4">Features & Tags</th>
                <th className="py-3 px-4 text-right">Speed Gauge</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-4 text-right">Diff (+ms)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Setup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredResolvers.map((r, index) => {
                const isFastest = r.rank === 1;
                // Compute mini bar relative width
                const barWidthPercent = r.latencyMs
                  ? Math.min(100, Math.max(12, Math.round((fastestLatency / r.latencyMs) * 100)))
                  : 0;

                return (
                  <tr
                    key={r.id || r.ip}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      isFastest ? 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04]' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-4 text-center font-bold">
                      {r.rank ? (
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-mono font-bold ${
                            r.rank === 1
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : r.rank === 2
                              ? 'bg-slate-300 text-slate-900'
                              : r.rank === 3
                              ? 'bg-amber-700/60 text-white'
                              : 'text-slate-400'
                          }`}
                        >
                          {r.rank}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Resolver & Provider */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {isFastest && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500 text-white font-extrabold uppercase">
                            Fastest
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">
                        {r.provider} • <span className="text-slate-500">{r.location}</span>
                      </p>
                    </td>

                    {/* Primary IP */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{r.ip}</span>
                        <button
                          onClick={() => handleCopyIp(r.ip, `table-p-${index}`)}
                          className="text-slate-400 hover:text-emerald-500 p-0.5"
                          title="Copy IP"
                        >
                          {copiedIp === `table-p-${index}-${r.ip}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Secondary IP */}
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {r.secondaryIp ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span>{r.secondaryIp}</span>
                          <button
                            onClick={() => handleCopyIp(r.secondaryIp, `table-s-${index}`)}
                            className="text-slate-400 hover:text-emerald-500 p-0.5"
                            title="Copy IP"
                          >
                            {copiedIp === `table-s-${index}-${r.secondaryIp}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    {/* Features Tags */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(r.features || []).map((feat) => (
                          <span
                            key={feat}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                              feat.includes('Ad-Block')
                                ? 'bg-rose-500/10 text-rose-500'
                                : feat.includes('Zero-Logs') || feat.includes('Privacy')
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : feat.includes('Threat') || feat.includes('Malware')
                                ? 'bg-indigo-500/10 text-indigo-500'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Mini Speed Gauge Bar */}
                    <td className="py-3 px-4 text-right">
                      {r.status === 'UP' && r.latencyMs !== null ? (
                        <div className="w-20 inline-block bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.latencyMs < 35
                                ? 'bg-emerald-500'
                                : r.latencyMs < 60
                                ? 'bg-cyan-500'
                                : r.latencyMs < 100
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${barWidthPercent}%` }}
                          ></div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>

                    {/* Latency ms */}
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {r.latencyMs !== null ? (
                        <span
                          className={`text-sm ${
                            r.latencyMs < 35
                              ? 'text-emerald-500'
                              : r.latencyMs < 60
                              ? 'text-cyan-500'
                              : r.latencyMs < 100
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {r.latencyMs}ms
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Timeout</span>
                      )}
                    </td>

                    {/* Diff vs fastest */}
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400">
                      {r.diffFromFastest !== null ? (
                        r.diffFromFastest === 0 ? (
                          <span className="text-emerald-500 font-bold">0ms</span>
                        ) : (
                          <span>+{r.diffFromFastest}ms</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {r.status === 'UP' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" /> UP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500">
                          <XCircle className="w-3.5 h-3.5" /> TIMEOUT
                        </span>
                      )}
                    </td>

                    {/* Setup Trigger */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSetupResolver(r)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white transition-all text-slate-700 dark:text-slate-300"
                      >
                        Apply
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Setup Instructions Modal */}
      {setupResolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Quick Setup Guide
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  How to Apply {setupResolver.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Configure this DNS server to enjoy {setupResolver.latencyMs ? `${setupResolver.latencyMs}ms latency` : 'fast performance'}.
                </p>
              </div>
              <button
                onClick={() => setSetupResolver(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* IP Box */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Preferred DNS (Primary):</span>
                <div className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                  <span>{setupResolver.ip}</span>
                  <button
                    onClick={() => handleCopyIp(setupResolver.ip, 'modal-p')}
                    className="p-1 text-slate-400 hover:text-emerald-500"
                  >
                    {copiedIp === `modal-p-${setupResolver.ip}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Alternate DNS (Secondary):</span>
                <div className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                  <span>{setupResolver.secondaryIp || '1.1.1.1'}</span>
                  <button
                    onClick={() => handleCopyIp(setupResolver.secondaryIp || '1.1.1.1', 'modal-s')}
                    className="p-1 text-slate-400 hover:text-emerald-500"
                  >
                    {copiedIp === `modal-s-${setupResolver.secondaryIp || '1.1.1.1'}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold">
              <button
                onClick={() => setSetupOsTab('windows')}
                className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                  setupOsTab === 'windows'
                    ? 'border-b-2 border-emerald-500 text-emerald-500'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" /> Windows 11 / 10
              </button>
              <button
                onClick={() => setSetupOsTab('router')}
                className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                  setupOsTab === 'router'
                    ? 'border-b-2 border-emerald-500 text-emerald-500'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" /> Wi-Fi Router (Whole Home)
              </button>
            </div>

            {/* Platform Instructions */}
            {setupOsTab === 'windows' && (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                  <li>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">Win + R</kbd>, type <code className="font-mono text-emerald-500">ncpa.cpl</code> and hit Enter.</li>
                  <li>Right-click your active Network Adapter (Wi-Fi or Ethernet) &rarr; <strong>Properties</strong>.</li>
                  <li>Select <strong>Internet Protocol Version 4 (TCP/IPv4)</strong> &rarr; Click <strong>Properties</strong>.</li>
                  <li>Select <em>"Use the following DNS server addresses"</em>:
                    <ul className="list-disc pl-5 mt-1 font-mono text-slate-900 dark:text-white">
                      <li>Preferred: <strong>{setupResolver.ip}</strong></li>
                      <li>Alternate: <strong>{setupResolver.secondaryIp || '1.1.1.1'}</strong></li>
                    </ul>
                  </li>
                  <li>Click <strong>OK</strong> to apply immediately.</li>
                </ol>

                <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>1-Click PowerShell Command:</span>
                    <button
                      onClick={() => {
                        const cmd = `Set-DnsClientServerAddress -InterfaceAlias (Get-NetAdapter | Where-Object Status -eq 'Up').Name -ServerAddresses ("${setupResolver.ip}","${setupResolver.secondaryIp || '1.1.1.1'}")`;
                        navigator.clipboard.writeText(cmd);
                        handleCopyIp(cmd, 'ps-cmd');
                      }}
                      className="hover:text-white"
                    >
                      {copiedIp?.startsWith('ps-cmd') ? 'Copied!' : 'Copy Command'}
                    </button>
                  </div>
                  <div className="break-all text-emerald-400">
                    Set-DnsClientServerAddress -InterfaceAlias (Get-NetAdapter | Where-Object Status -eq 'Up').Name -ServerAddresses ("{setupResolver.ip}","{setupResolver.secondaryIp || '1.1.1.1'}")
                  </div>
                </div>
              </div>
            )}

            {setupOsTab === 'router' && (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>Configuring on your home router applies this DNS automatically to <strong>all phones, laptops, and smart TVs</strong> connected to your Wi-Fi:</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Open browser &rarr; Go to router gateway IP (usually <code className="font-mono text-emerald-500">192.168.1.1</code> or <code className="font-mono text-emerald-500">192.168.0.1</code>).</li>
                  <li>Log in with admin credentials.</li>
                  <li>Navigate to <strong>WAN / Internet</strong> or <strong>DHCP Settings</strong>.</li>
                  <li>Set Primary DNS to <strong className="font-mono text-slate-900 dark:text-white">{setupResolver.ip}</strong>.</li>
                  <li>Set Secondary DNS to <strong className="font-mono text-slate-900 dark:text-white">{setupResolver.secondaryIp || '1.1.1.1'}</strong>.</li>
                  <li>Save & Reboot router.</li>
                </ol>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSetupResolver(null)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
