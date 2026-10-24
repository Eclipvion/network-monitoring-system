import React, { useState } from 'react';
import {
  LayoutDashboard,
  Server,
  Activity,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  Settings,
  Radio,
  ShieldCheck,
  ShieldAlert,
  Route,
  Globe,
  Network,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeAlertCount = 0,
  mobileOpen = false,
  onCloseMobile
}) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices', icon: Server },
    { id: 'topology', label: 'Topology Map', icon: Network },
    { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
    { id: 'reports', label: 'Reports & Audits', icon: FileSpreadsheet },
    { id: 'diagnostics', label: 'Diagnostics', icon: Route },
    { id: 'dns', label: 'DNS Performance', icon: Globe },
    { id: 'domains', label: 'Domain Health', icon: ShieldCheck },
    { id: 'security', label: 'Security Hub', icon: ShieldAlert },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (isDrawer = false) => (
    <div className={`h-full flex flex-col justify-between ${isDrawer ? 'w-72' : collapsed ? 'w-20' : 'w-64'} transition-all duration-300`}>
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            {(!collapsed || isDrawer) && (
              <div className="min-w-0">
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                  NetPulse
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    PRO
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 truncate">Enterprise NOC Suite</p>
              </div>
            )}
          </div>

          {/* Close button for mobile drawer OR Collapse button for desktop */}
          {isDrawer ? (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-8.5rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                title={collapsed && !isDrawer ? item.label : undefined}
                className={`w-full flex items-center ${
                  collapsed && !isDrawer ? 'justify-center px-0' : 'justify-between px-3.5'
                } py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                  {(!collapsed || isDrawer) && <span className="truncate">{item.label}</span>}
                </div>
                {item.badge > 0 && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors shrink-0 ${
                      isActive
                        ? 'bg-white text-rose-600'
                        : 'bg-rose-500 text-white animate-pulse'
                    } ${collapsed && !isDrawer ? 'absolute -top-1 -right-1 ring-2 ring-slate-900' : ''}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Engine Status Footer */}
      <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800/80 shrink-0">
        {(!collapsed || isDrawer) ? (
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Pro Engine
              </span>
              <span className="text-emerald-500 font-mono text-[11px]">Python 3.12</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Telemetry Array</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Active (1s)</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Python 3.12 Monitoring Engine Active">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className={`hidden lg:flex border-r border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0c121e]/85 backdrop-blur-xl shrink-0 z-30 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}>
        {sidebarContent(false)}
      </aside>

      {/* 2. Mobile / Tablet Responsive Off-Canvas Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Sliding Drawer Container */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-[#0c121e] border-r border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
