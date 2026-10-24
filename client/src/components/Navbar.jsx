import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Pause,
  Play,
  ChevronDown,
  Clock,
  Check,
  Menu
} from 'lucide-react';

export default function Navbar({
  activeTab,
  darkMode,
  setDarkMode,
  socketConnected,
  lastUpdated,
  onRefresh,
  loading,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  autoRefreshInterval,
  onChangeInterval,
  countdown,
  onToggleMobileSidebar
}) {
  const [showIntervalMenu, setShowIntervalMenu] = useState(false);
  const [recentlyRefreshed, setRecentlyRefreshed] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowIntervalMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualClick = async () => {
    setRecentlyRefreshed(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setRecentlyRefreshed(false), 1400);
  };

  const titles = {
    overview: 'Infrastructure Overview',
    devices: 'Device Management',
    monitoring: 'Real-Time Sensor Matrix',
    diagnostics: 'Network Diagnostics & Traceroute',
    dns: 'DNS Resolver Benchmark & Performance',
    domains: 'Domain & SSL Certificate Health',
    alerts: 'System Incident Alerts',
    logs: 'Audit & Activity Logs',
    settings: 'Threshold & System Settings',
    reports: 'SLA & Executive Reports'
  };

  const intervals = [
    { label: '2s (Ultra Fast / Real-Time)', value: 2, icon: '⚡' },
    { label: '5s (Recommended)', value: 5, icon: '⏱️' },
    { label: '10s (Standard)', value: 10, icon: '⏱️' },
    { label: '30s (Eco Mode)', value: 30, icon: '🌱' },
    { label: '60s (Slow)', value: 60, icon: '🐢' }
  ];

  // Calculate percentage of remaining countdown
  const progressPercent = autoRefreshEnabled && autoRefreshInterval > 0
    ? Math.max(0, Math.min(100, ((autoRefreshInterval - (countdown ?? autoRefreshInterval)) / autoRefreshInterval) * 100))
    : 0;

  return (
    <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0c121e]/85 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0 transition-colors">
      {/* Left: Mobile Toggle + Page Title & Last Sync */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
            {titles[activeTab] || 'Monitoring'}
          </h2>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="truncate">
              Last sync: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Awaiting data...'}
            </span>
            {recentlyRefreshed && (
              <span className="text-[10px] text-emerald-500 font-semibold animate-pulse flex items-center gap-0.5 shrink-0">
                <Check className="w-3 h-3" /> Updated
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Real-time Socket Indicator */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          socketConnected
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        }`}>
          {socketConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span>Live Socket</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>Polling Mode</span>
            </>
          )}
        </div>

        {/* Auto Refresh Dropdown & Countdown Widget */}
        <div className="relative" ref={menuRef}>
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden shadow-sm">
            {/* Toggle Pause/Resume button */}
            <button
              type="button"
              onClick={() => onToggleAutoRefresh && onToggleAutoRefresh(!autoRefreshEnabled)}
              title={autoRefreshEnabled ? 'Click to Pause Auto-Refresh' : 'Click to Enable Auto-Refresh'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                autoRefreshEnabled
                  ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {autoRefreshEnabled ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
                  <span className="font-mono font-semibold">Auto: {countdown ?? autoRefreshInterval}s</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-slate-400" />
                  <span>Auto: Off</span>
                </>
              )}
            </button>

            {/* Menu trigger button */}
            <button
              type="button"
              onClick={() => setShowIntervalMenu(!showIntervalMenu)}
              title="Change Auto-Refresh Interval"
              className="px-1.5 py-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress bar under the pill when enabled */}
          {autoRefreshEnabled && (
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-0.5 rounded-full overflow-hidden mt-0.5">
              <div
                className="bg-cyan-500 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Interval Selector Popover */}
          {showIntervalMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Auto-Refresh Timer</span>
                <Clock className="w-3 h-3 text-slate-400" />
              </div>

              <div className="py-1">
                {intervals.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (onChangeInterval) onChangeInterval(item.value);
                      setShowIntervalMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      autoRefreshEnabled && autoRefreshInterval === item.value
                        ? 'text-cyan-600 dark:text-cyan-400 font-semibold bg-cyan-500/5'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {autoRefreshEnabled && autoRefreshInterval === item.value && (
                      <Check className="w-3.5 h-3.5 text-cyan-500" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onToggleAutoRefresh) onToggleAutoRefresh(!autoRefreshEnabled);
                    setShowIntervalMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {autoRefreshEnabled ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pause Auto-Refresh</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Resume Auto-Refresh ({autoRefreshInterval || 5}s)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manual Reload / Refresh Button */}
        <button
          type="button"
          onClick={handleManualClick}
          disabled={loading}
          title="Reload Data Now (Instant Sync)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Reload</span>
        </button>

        {/* Dark/Light Mode Toggle */}
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
}
