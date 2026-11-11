import React from 'react';
import {
  Sliders,
  Globe,
  Bell,
  Mail,
  Building,
  ShieldCheck,
  Database
} from 'lucide-react';

export default function SettingsTabsNav({ activeTab, onSelectTab, settings }) {
  const tabs = [
    {
      id: 'email',
      label: 'Email & Recipients',
      icon: Mail,
      badge: 'SMTP & Auto-Send'
    },
    {
      id: 'engine',
      label: 'Engine & Thresholds',
      icon: Sliders,
      badge: `${settings.defaultInterval || 30}s`
    },
    {
      id: 'isp',
      label: 'ISP & WAN Uplink',
      icon: Globe,
      badge: settings.ispName ? 'Configured' : 'Live WAN'
    },
    {
      id: 'alerts',
      label: 'Alerts & Webhooks',
      icon: Bell,
      badge: settings.enableWebhookAlerts ? 'Webhook ON' : (settings.enableSoundAlerts ? 'Audio' : 'Alerts')
    },
    {
      id: 'branding',
      label: 'Branding & SLA',
      icon: Building,
      badge: `${settings.slaTargetPercent || 99.9}%`
    },
    {
      id: 'sslDns',
      label: 'SSL & DNS Sensors',
      icon: ShieldCheck,
      badge: `${settings.sslWarningDaysThreshold || 14}d SSL`
    },
    {
      id: 'maintenance',
      label: 'System & Maintenance',
      icon: Database,
      badge: 'Storage'
    }
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap pb-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              isActive
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 shadow-xs'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-600 dark:text-slate-400'}`} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
