import React from 'react';
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
  Route,
  Globe
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, activeAlertCount = 0 }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices', icon: Server },
    { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
    { id: 'reports', label: 'Reports & Audits', icon: FileSpreadsheet },
    { id: 'diagnostics', label: 'Diagnostics', icon: Route },
    { id: 'dns', label: 'DNS Performance', icon: Globe },
    { id: 'domains', label: 'Domain Health', icon: ShieldCheck },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
          <Activity className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
            NetPulse
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              NMS
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Network Monitor v1.0</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                    isActive
                      ? 'bg-white text-rose-600'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Engine Status Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Engine
            </span>
            <span className="text-emerald-500 font-semibold">Python 3.12</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Data Layer</span>
            <span className="font-mono text-slate-600 dark:text-slate-300">JSON (Phase 1)</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
