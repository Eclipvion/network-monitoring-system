import React, { useState, useMemo } from 'react';
import {
  Search,
  Wifi,
  Globe,
  Radar,
  Copy,
  ChevronDown,
  ChevronUp,
  Unlock,
  ArrowUpRight,
  ShieldAlert,
  Server
} from 'lucide-react';

export default function AttackSurfaceTab({
  devices = [],
  audits = {},
  scanningDeviceId = null,
  isScanningAll = false,
  handleScanDevice,
  openVulnerabilityModal,
  handleCopyText,
  isLocalIp
}) {
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL'); // 'ALL' | 'ONLINE' | 'VULNERABLE' | 'SECURE' | 'OFFLINE'
  const [deviceScopeFilter, setDeviceScopeFilter] = useState('ALL'); // 'ALL' | 'LOCAL' | 'PUBLIC'
  const [expandedDeviceIds, setExpandedDeviceIds] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isDeviceOffline = (d) => {
    const isMonitored = d.monitoring !== false;
    const isDownStatus = (d.status || '').toUpperCase() === 'DOWN';
    return isMonitored && isDownStatus;
  };

  const onlineDevices = useMemo(() => {
    return devices.filter((d) => !isDeviceOffline(d));
  }, [devices]);

  const localOnlineCount = useMemo(() => {
    return onlineDevices.filter((d) => isLocalIp(d.ip)).length;
  }, [onlineDevices, isLocalIp]);

  const publicOnlineCount = useMemo(() => {
    return onlineDevices.filter((d) => !isLocalIp(d.ip)).length;
  }, [onlineDevices, isLocalIp]);

  const filteredDevices = useMemo(() => {
    return devices.filter((dev) => {
      // 1. Scope filter
      const isLocal = isLocalIp(dev.ip);
      if (deviceScopeFilter === 'LOCAL' && !isLocal) return false;
      if (deviceScopeFilter === 'PUBLIC' && isLocal) return false;

      // 2. Search query
      const q = deviceSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        dev.name.toLowerCase().includes(q) ||
        dev.ip.toLowerCase().includes(q) ||
        (dev.type && dev.type.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 3. Status filter
      const isDown = isDeviceOffline(dev);
      const audit = audits[dev.id] || audits[dev.ip];
      const hasOpenPorts = (audit?.openPorts || []).length > 0;

      if (deviceFilter === 'ONLINE') return !isDown;
      if (deviceFilter === 'OFFLINE') return isDown;
      if (deviceFilter === 'VULNERABLE') return !isDown && hasOpenPorts;
      if (deviceFilter === 'SECURE') return !isDown && !hasOpenPorts;

      return true;
    });
  }, [devices, audits, deviceSearch, deviceFilter, deviceScopeFilter, isLocalIp]);

  return (
    <div className="space-y-4">
      {/* Controls Bar: Scope, Search & Status Filter */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Segmented Scope Pill Buttons (Responsive Scroll) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setDeviceScopeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                deviceScopeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>All Targets</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 font-mono">
                {onlineDevices.length} on
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDeviceScopeFilter('LOCAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                deviceScopeFilter === 'LOCAL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-500'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Local Wi-Fi LAN</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${deviceScopeFilter === 'LOCAL' ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                {localOnlineCount} on
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDeviceScopeFilter('PUBLIC')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                deviceScopeFilter === 'PUBLIC'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-400'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Cloud & Internet</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${deviceScopeFilter === 'PUBLIC' ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-400'}`}>
                {publicOnlineCount} on
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono self-start sm:self-auto">
            Showing <strong className="text-slate-700 dark:text-slate-200">{filteredDevices.length}</strong> of {devices.length} hosts
          </div>
        </div>

        {/* Search & Filter Controls (Responsive Flex) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search host name, IP address, or type..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shrink-0"
          >
            <option value="ALL">All Status ({devices.length})</option>
            <option value="ONLINE">Online Active ({onlineDevices.length})</option>
            <option value="VULNERABLE">Vulnerable Only</option>
            <option value="SECURE">Secure & Shielded Only</option>
            <option value="OFFLINE">Offline / Down ({devices.length - onlineDevices.length})</option>
          </select>
        </div>
      </div>

      {/* Device Cards Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredDevices.map((device) => {
          const audit = audits[device.id] || audits[device.ip];
          const isScanning = scanningDeviceId === device.id;
          const isExpanded = expandedDeviceIds.has(device.id);

          const isDown = isDeviceOffline(device);
          const riskLevel = isDown ? 'OFFLINE' : (audit?.overallLevel || 'UNAUDITED');
          const riskScore = isDown ? null : (audit?.riskScore ?? null);
          const openPorts = isDown ? [] : (audit?.openPorts || []);

          return (
            <div
              key={device.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 shadow-sm ${
                isDown
                  ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/80 opacity-75'
                  : riskLevel === 'CRITICAL'
                    ? 'bg-white dark:bg-slate-900 border-rose-500/40 ring-1 ring-rose-500/20'
                    : riskLevel === 'HIGH'
                      ? 'bg-white dark:bg-slate-900 border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Device Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {device.name}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {device.type}
                    </span>
                    {isLocalIp(device.ip) ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono flex items-center gap-1">
                        <Wifi className="w-2.5 h-2.5" /> LAN
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> CLOUD
                      </span>
                    )}
                    {isDown && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-mono">
                        DOWN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono text-slate-400 mt-1">
                    <span>{device.ip}</span>
                    <button
                      onClick={() => handleCopyText(device.ip)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Copy IP"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isDown ? (
                    <div className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Offline
                    </div>
                  ) : riskScore !== null ? (
                    <div className={`px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono ${
                      riskScore >= 85
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : riskScore >= 70
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {riskScore}/100
                    </div>
                  ) : null}

                  <button
                    onClick={() => handleScanDevice(device)}
                    disabled={isScanning || isScanningAll || isDown}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isDown
                        ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : 'text-slate-500 hover:text-rose-500 hover:bg-rose-500/10'
                    }`}
                    title="Audit device ports"
                  >
                    <Radar className={`w-4 h-4 ${isScanning ? 'animate-spin text-rose-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Open Ports List */}
              {openPorts.length > 0 ? (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-500 flex items-center gap-1 text-[11px]">
                      <Unlock className="w-3 h-3" /> {openPorts.length} Open Port(s) Exposed:
                    </span>
                    <button
                      onClick={() => toggleExpand(device.id)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {openPorts.map((p) => {
                      const isCrit = p.risk === 'CRITICAL';
                      const isHigh = p.risk === 'HIGH';
                      return (
                        <button
                          key={p.port}
                          onClick={() => openVulnerabilityModal(p, device)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isCrit
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                              : isHigh
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/25'
                          }`}
                          title="Click to view full CVE details & copy firewall rule"
                        >
                          <span>{p.port}</span>
                          <span className="opacity-70 text-[9px]">({p.service})</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </button>
                      );
                    })}
                  </div>

                  {/* Expanded Port Exploit Details */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {openPorts.map((p) => (
                        <div
                          key={p.port}
                          onClick={() => openVulnerabilityModal(p, device)}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-rose-500/40 text-xs space-y-1 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                            <span className="text-slate-900 dark:text-white">Port {p.port} ({p.service})</span>
                            <span className={p.risk === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}>
                              {p.risk} RISK
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {p.description || p.cve}
                          </p>
                          <span className="text-[10px] text-rose-500 font-semibold block">
                            Click to generate firewall lockdown rule →
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isDown ? (
                <p className="text-xs text-slate-400 italic">
                  Device is currently offline. Auditing paused.
                </p>
              ) : (
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-emerald-500 font-medium">
                  <span>✓ All monitored ports sealed</span>
                  <button
                    onClick={() => handleScanDevice(device)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    Re-verify
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredDevices.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Server className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No monitored devices match your criteria.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try resetting the search or filter settings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
