import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Monitor,
  User,
  Download,
  Sparkles,
  Youtube,
  Compass,
  Terminal,
  X,
  Check,
  Copy
} from 'lucide-react';
import api from '../../services/api';

export default function DnsTrafficTab({
  devices = [],
  dnsTraffic = [],
  dnsSearch,
  setDnsSearch,
  dnsCategoryFilter,
  setDnsCategoryFilter,
  dnsThreatFilter,
  setDnsThreatFilter,
  isHarvestingDns,
  handleHarvestDns,
  handleClearDns,
  handleCopyText
}) {
  // Sub-filter states for Layer-2 Search & Web Activity
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL'); // 'ALL' | 'SEARCH' | 'WEB_VISIT' | 'DNS'
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [profileFilter, setProfileFilter] = useState('ALL');
  const [browserFilter, setBrowserFilter] = useState('ALL');

  // Client Agent Modal state
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(
    `${window.location.protocol}//${window.location.hostname}:5000`
  );
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Map IP -> registered device name from NetPulse devices list
  const deviceNameMap = useMemo(() => {
    const map = new Map();
    devices.forEach((d) => {
      if (d.ip) map.set(String(d.ip).trim(), d.name);
    });
    return map;
  }, [devices]);

  // Summary KPIs
  const stats = useMemo(() => {
    const total = dnsTraffic.length;
    const searches = dnsTraffic.filter(
      (t) => Boolean(t.searchQuery && String(t.searchQuery).trim()) || t.queryType === 'SEARCH'
    ).length;
    const webVisits = dnsTraffic.filter(
      (t) => t.queryType === 'WEB_VISIT' && !(t.searchQuery && String(t.searchQuery).trim())
    ).length;
    const dnsOnly = dnsTraffic.filter(
      (t) => t.queryType === 'DNS' || t.queryType === 'A' || t.queryType === 'AAAA'
    ).length;
    const uniqueClients = new Set(
      dnsTraffic.map((t) => `${t.clientIp || 'Local'}|${t.hostname || ''}`)
    ).size;
    const flagged = dnsTraffic.filter(
      (t) => t.threatLevel === 'MALICIOUS' || t.threatLevel === 'SUSPICIOUS'
    ).length;

    return { total, searches, webVisits, dnsOnly, uniqueClients, flagged };
  }, [dnsTraffic]);

  const dnsCategories = useMemo(() => {
    return Array.from(new Set(dnsTraffic.map((t) => t.category))).filter(Boolean);
  }, [dnsTraffic]);

  const availableDevices = useMemo(() => {
    const map = new Map();
    dnsTraffic.forEach((t) => {
      const ip = t.clientIp || 'Local Machine';
      if (!map.has(ip)) {
        const regName = deviceNameMap.get(ip);
        const hostLabel = regName || t.hostname || 'Endpoint';
        map.set(ip, `${ip} (${hostLabel})`);
      }
    });
    return Array.from(map.entries());
  }, [dnsTraffic, deviceNameMap]);

  const availableProfiles = useMemo(() => {
    return Array.from(
      new Set(
        dnsTraffic
          .filter((t) => t.username && t.browser !== 'DNS Cache')
          .map((t) => t.username)
      )
    ).filter(Boolean);
  }, [dnsTraffic]);

  const availableBrowsers = useMemo(() => {
    return Array.from(new Set(dnsTraffic.map((t) => t.browser || 'DNS Cache'))).filter(Boolean);
  }, [dnsTraffic]);

  const filteredDns = useMemo(() => {
    return dnsTraffic.filter((item) => {
      const q = (dnsSearch || '').toLowerCase().trim();
      const hasSearchQuery = Boolean(item.searchQuery && String(item.searchQuery).trim());

      const matchesSearch =
        !q ||
        (item.domain && item.domain.toLowerCase().includes(q)) ||
        (item.searchQuery && item.searchQuery.toLowerCase().includes(q)) ||
        (item.pageTitle && item.pageTitle.toLowerCase().includes(q)) ||
        (item.url && item.url.toLowerCase().includes(q)) ||
        (item.clientIp && item.clientIp.toLowerCase().includes(q)) ||
        (item.hostname && item.hostname.toLowerCase().includes(q)) ||
        (item.username && item.username.toLowerCase().includes(q)) ||
        (item.profileEmail && item.profileEmail.toLowerCase().includes(q));

      const matchesType =
        activityTypeFilter === 'ALL' ||
        (activityTypeFilter === 'SEARCH' && (hasSearchQuery || item.queryType === 'SEARCH')) ||
        (activityTypeFilter === 'WEB_VISIT' && item.queryType === 'WEB_VISIT' && !hasSearchQuery) ||
        (activityTypeFilter === 'DNS' &&
          (item.queryType === 'DNS' || item.queryType === 'A' || item.queryType === 'AAAA'));

      const matchesDevice = deviceFilter === 'ALL' || item.clientIp === deviceFilter;
      const matchesProfile = profileFilter === 'ALL' || item.username === profileFilter;
      const matchesBrowser =
        browserFilter === 'ALL' || (item.browser || 'DNS Cache') === browserFilter;
      const matchesCat = dnsCategoryFilter === 'ALL' || item.category === dnsCategoryFilter;
      const matchesThreat = dnsThreatFilter === 'ALL' || item.threatLevel === dnsThreatFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesDevice &&
        matchesProfile &&
        matchesBrowser &&
        matchesCat &&
        matchesThreat
      );
    });
  }, [
    dnsTraffic,
    dnsSearch,
    activityTypeFilter,
    deviceFilter,
    profileFilter,
    browserFilter,
    dnsCategoryFilter,
    dnsThreatFilter
  ]);

  const handleDownloadAgentBat = async () => {
    try {
      const cleanUrl = (serverUrlInput || 'http://localhost:5000').trim();
      const res = await api.getSearchAgentScript(cleanUrl);
      if (res && res.script) {
        const blob = new Blob([res.script], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || 'NetPulse_Client_Search_Agent.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert(`Failed to generate agent script: ${err.message}`);
    }
  };

  const renderBrowserBadge = (browserName) => {
    const b = (browserName || 'DNS Cache').toLowerCase();
    if (b.includes('chrome')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Chrome
        </span>
      );
    }
    if (b.includes('edge')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Edge
        </span>
      );
    }
    if (b.includes('brave')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Brave
        </span>
      );
    }
    if (b.includes('firefox')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Firefox
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 text-[10px] font-mono">
        <Globe className="w-3 h-3" /> {browserName || 'DNS'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* LAYER-2 SUMMARY METRICS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => setActivityTypeFilter('SEARCH')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activityTypeFilter === 'SEARCH'
              ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Exact User Searches
            </span>
            <Search className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
              {stats.searches}
            </span>
            <span className="text-[11px] text-slate-400">Google / YouTube / AI</span>
          </div>
        </div>

        <div
          onClick={() => setActivityTypeFilter('WEB_VISIT')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activityTypeFilter === 'WEB_VISIT'
              ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Visited Web Pages
            </span>
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.webVisits}
            </span>
            <span className="text-[11px] text-slate-400">Full URLs & Titles</span>
          </div>
        </div>

        <div
          onClick={() => setActivityTypeFilter('ALL')}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/30 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Monitored PCs
            </span>
            <Monitor className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.uniqueClients}
            </span>
            <span className="text-[11px] text-slate-400">Reporting Endpoints</span>
          </div>
        </div>

        <div
          onClick={() =>
            setDnsThreatFilter(dnsThreatFilter === 'ALL' ? 'SUSPICIOUS' : 'ALL')
          }
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-rose-500/30 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Flagged Searches / Sites
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-black ${
                stats.flagged > 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {stats.flagged}
            </span>
            <span className="text-[11px] text-slate-400">
              {stats.flagged > 0 ? 'Policy / Threat Alerts' : 'All Clean'}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW MODE PILLS & CONTROLS BAR */}
      <div className="p-3.5 sm:p-4 rounded-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        {/* Top Row: Activity Type Tabs + Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActivityTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activityTypeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Activity ({stats.total})
            </button>
            <button
              onClick={() => setActivityTypeFilter('SEARCH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                activityTypeFilter === 'SEARCH'
                  ? 'bg-cyan-500 text-white shadow-xs'
                  : 'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Exact Search Queries ({stats.searches})</span>
            </button>
            <button
              onClick={() => setActivityTypeFilter('WEB_VISIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activityTypeFilter === 'WEB_VISIT'
                  ? 'bg-indigo-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Visited Websites ({stats.webVisits})
            </button>
            <button
              onClick={() => setActivityTypeFilter('DNS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activityTypeFilter === 'DNS'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              DNS Queries ({stats.dnsOnly})
            </button>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
            <button
              onClick={() => setShowAgentModal(true)}
              className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download Layer-2 Search Agent for other connected Office PCs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Deploy to Other PCs</span>
            </button>

            <button
              onClick={handleHarvestDns}
              disabled={isHarvestingDns}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Harvest live Browser Searches (Chrome, Edge, Brave, Firefox) & DNS Cache"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isHarvestingDns ? 'animate-spin' : ''}`} />
              <span>{isHarvestingDns ? 'Harvesting...' : 'Harvest Searches & Web'}</span>
            </button>

            {dnsTraffic.length > 0 && (
              <button
                onClick={handleClearDns}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                title="Clear activity history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Search Bar & Dropdown Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by user keyword, page title, website domain, username, or IP..."
              value={dnsSearch}
              onChange={(e) => setDnsSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Connected PCs / IPs</option>
              {availableDevices.map(([ip, label]) => (
                <option key={ip} value={ip}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none max-w-[220px]"
            >
              <option value="ALL">All Logged-in Profiles</option>
              {availableProfiles.map((p) => (
                <option key={p} value={p}>
                  👤 {p}
                </option>
              ))}
            </select>

            <select
              value={browserFilter}
              onChange={(e) => setBrowserFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Browsers</option>
              {availableBrowsers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={dnsCategoryFilter}
              onChange={(e) => setDnsCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {dnsCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={dnsThreatFilter}
              onChange={(e) => setDnsThreatFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Threats</option>
              <option value="SAFE">Safe Only</option>
              <option value="SUSPICIOUS">Suspicious Only</option>
              <option value="MALICIOUS">Malicious Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden sm:block rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left min-w-[700px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3 sm:px-4 w-[11%] min-w-[75px] whitespace-nowrap">Time</th>
                <th className="py-3 px-3 sm:px-4 w-[23%] min-w-[140px]">Device / User</th>
                <th className="py-3 px-2.5 sm:px-3 w-[11%] min-w-[80px] whitespace-nowrap">Browser</th>
                <th className="py-3 px-3 sm:px-4 min-w-[200px]">User Search Query / Visited Page &amp; Website</th>
                <th className="py-3 px-2.5 sm:px-3 w-[11%] min-w-[80px] whitespace-nowrap">Category</th>
                <th className="py-3 px-3 sm:px-4 w-[11%] min-w-[85px] text-right whitespace-nowrap">Threat Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {filteredDns.map((item) => {
                const isMalicious = item.threatLevel === 'MALICIOUS';
                const isSuspicious = item.threatLevel === 'SUSPICIOUS';
                const hasSearch = Boolean(item.searchQuery && String(item.searchQuery).trim());
                const registeredName = deviceNameMap.get(item.clientIp);
                const endpointTitle = registeredName || item.hostname || 'Endpoint';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isMalicious
                        ? 'bg-rose-500/10'
                        : isSuspicious
                          ? 'bg-amber-500/5'
                          : hasSearch
                            ? 'bg-cyan-500/[0.03] hover:bg-cyan-500/[0.07]'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Time */}
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap align-top">
                      <div>{new Date(item.timestamp).toLocaleTimeString()}</div>
                      <div className="text-[10px] text-slate-400/70">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Device / User */}
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span>{endpointTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                        <span>{item.clientIp}</span>
                        {item.username && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]">
                            <User className="w-2.5 h-2.5" />
                            {item.username}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Browser */}
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      {renderBrowserBadge(item.browser)}
                    </td>

                    {/* Search Query / Page Title / Website */}
                    <td className="py-3 px-4 align-top max-w-md">
                      {hasSearch ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                              {item.searchEngine?.toLowerCase().includes('youtube') ? (
                                <Youtube className="w-3 h-3 text-rose-500" />
                              ) : item.searchEngine?.toLowerCase().includes('ai') ? (
                                <Sparkles className="w-3 h-3 text-purple-500" />
                              ) : (
                                <Search className="w-3 h-3 text-cyan-500" />
                              )}
                              {item.searchEngine || 'Search Query'}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white text-xs bg-amber-500/10 dark:bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 dark:border-cyan-500/20">
                              "{item.searchQuery}"
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">
                              {item.domain}
                            </span>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-cyan-500 hover:underline"
                                title={item.url}
                              >
                                <span>Open Link</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                            {item.pageTitle && item.pageTitle !== item.domain
                              ? item.pageTitle
                              : item.domain}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                            <span>{item.domain}</span>
                            {item.url && item.queryType !== 'DNS' && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-cyan-500 hover:underline"
                                title={item.url}
                              >
                                <span>Visit</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                        {item.category}
                      </span>
                    </td>

                    {/* Threat Status */}
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isMalicious
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : isSuspicious
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isMalicious ? (
                            <XCircle className="w-3 h-3 text-rose-500" />
                          ) : isSuspicious ? (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          )}
                          {item.threatLevel}
                        </span>
                        <div className="text-[10px] text-slate-400 line-clamp-1">
                          {item.flagReason}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredDns.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                    No user searches or web activity matching current filters. Click{' '}
                    <strong className="text-emerald-500">"Harvest Searches & Web"</strong> to capture
                    real-time browser searches and websites.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CARDS VIEW (< sm) */}
      <div className="sm:hidden space-y-2.5">
        {filteredDns.map((item) => {
          const isMalicious = item.threatLevel === 'MALICIOUS';
          const isSuspicious = item.threatLevel === 'SUSPICIOUS';
          const hasSearch = Boolean(item.searchQuery && String(item.searchQuery).trim());

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border space-y-2 text-xs shadow-xs ${
                isMalicious
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : isSuspicious
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {renderBrowserBadge(item.browser)}
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {hasSearch ? (
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-cyan-500">
                    🔎 {item.searchEngine || 'Search Query'}
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    "{item.searchQuery}"
                  </div>
                </div>
              ) : (
                <div className="font-bold text-slate-900 dark:text-white line-clamp-2">
                  {item.pageTitle || item.domain}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  {item.hostname || 'PC'} ({item.clientIp})
                </span>
                <span className="truncate max-w-[140px]">{item.domain}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: DEPLOY CLIENT SEARCH AGENT TO OTHER CONNECTED OFFICE PCs */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    Deploy Layer-2 Search Agent (Connected Office PCs)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Monitor exact Google, YouTube, Bing searches & visited websites on any PC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                <div>
                  <strong>1-Click Auto-Scheduler & Multi-User Agent:</strong> Is{' '}
                  <code>NetPulse_Client_Search_Agent.bat</code> file ko kisi bhi PC par sirf{' '}
                  <strong>ek dafa run karein</strong>:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Windows Task Scheduler Auto-Run:</strong> Yeh khud ko Windows Task
                    Scheduler me register kar leta hai aur <strong>har 30 minute baad</strong>{' '}
                    background me (bina koi black screen dikhaye) data sync karta hai.
                  </li>
                  <li>
                    <strong>All Windows Users Covered (C:\Users\*):</strong> Agar us PC par koi
                    doosra Windows User login ho kar bhi browsing ya searching karega, to yeh tamam
                    Windows User accounts ke Chrome, Edge, Brave, aur Firefox ki searches unke
                    Username ke sath aapke Server par bhejega!
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Aapke NetPulse Server ka IP / URL (Jahan data aayega):
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://172.18.1.11:5000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400">
                  Note: Agar doosre PC par chalana hai to <code>localhost</code> ki jagah is Server
                  PC ka LAN IP likhein (e.g. <code>http://172.18.1.11:5000</code>).
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Ya Terminal Command se direct run karein:
                </span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px]">
                  <span className="truncate flex-1">
                    run_threat_sniffer.bat "{serverUrlInput}"
                  </span>
                  <button
                    onClick={() =>
                      handleCopyText(`run_threat_sniffer.bat "${serverUrlInput}"`, setCopiedCmd)
                    }
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadAgentBat}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-600 hover:from-indigo-600 hover:to-cyan-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Standalone Agent (.bat)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
