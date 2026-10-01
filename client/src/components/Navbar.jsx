import React from 'react';
import {
  Sun,
  Moon,
  RefreshCw,
  Wifi,
  WifiOff,
  Bell
} from 'lucide-react';

export default function Navbar({
  activeTab,
  darkMode,
  setDarkMode,
  socketConnected,
  lastUpdated,
  onRefresh,
  loading
}) {
  const titles = {
    overview: 'Infrastructure Overview',
    devices: 'Device Management',
    monitoring: 'Real-Time Sensor Matrix',
    diagnostics: 'Network Diagnostics & Traceroute',
    dns: 'DNS Resolver Benchmark & Performance',
    domains: 'Domain & SSL Certificate Health',
    alerts: 'System Incident Alerts',
    logs: 'Audit & Activity Logs',
    settings: 'Threshold & System Settings'
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between z-10 sticky top-0">
      {/* Page Title */}
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {titles[activeTab] || 'Monitoring'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last synchronized: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Awaiting data...'}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Real-time Socket Indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          socketConnected
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        }`}>
          {socketConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>Live Socket</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>Connecting...</span>
            </>
          )}
        </div>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh metrics"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
        </button>

        {/* Dark/Light Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
}
