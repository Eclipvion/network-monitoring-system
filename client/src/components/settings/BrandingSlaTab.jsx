import React from 'react';
import { Building, Award, Image, FileText, CheckCircle2, Clock } from 'lucide-react';

export default function BrandingSlaTab({ settings, onChange }) {
  const slaPresets = [
    { label: '99.0% (Two 9s)', val: 99.0 },
    { label: '99.5%', val: 99.5 },
    { label: '99.9% (Three 9s)', val: 99.9 },
    { label: '99.99% (Four 9s)', val: 99.99 }
  ];

  // Dynamic downtime calculation per 30-day month (43,200 total minutes)
  const calculateDowntimeBudget = (sla) => {
    const totalMinutesPerMonth = 43200;
    const allowedDownMinutes = totalMinutesPerMonth * (1 - (sla / 100));
    if (allowedDownMinutes >= 60) {
      return `${(allowedDownMinutes / 60).toFixed(2)} hours/month`;
    }
    return `${allowedDownMinutes.toFixed(1)} minutes/month`;
  };

  return (
    <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Building className="w-4 h-4 text-emerald-500" />
          Enterprise White-Labeling & Customer SLA Benchmarks
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Customize executive PDF report branding, organization title, logo URLs, and uptime compliance goals.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Organization Name */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Organization / NOC Brand Name
          </label>
          <input
            type="text"
            value={settings.organizationName || ''}
            onChange={(e) => onChange('organizationName', e.target.value)}
            placeholder="e.g. Ability or NetPulse NOC"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <p className="text-[11px] text-slate-400">
            Displayed on header banners, PDF exports, and executive customer reports.
          </p>
        </div>

        {/* Report Subtitle */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Report Header Subtitle
          </label>
          <input
            type="text"
            value={settings.reportSubtitle || ''}
            onChange={(e) => onChange('reportSubtitle', e.target.value)}
            placeholder="e.g. Infrastructure SLA & Downtime Audit Report"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <p className="text-[11px] text-slate-400">
            Default document headline for scheduled automated audit emails.
          </p>
        </div>

        {/* SLA Target % & Live Downtime Budget */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 sm:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-500" />
                Target Uptime SLA Commitment (%)
              </label>
              <p className="text-[11px] text-slate-400">
                Determines compliance metrics on the SLA Dashboard and Audit reports.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                {settings.slaTargetPercent ?? 99.9}% Uptime Goal
              </span>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                Max Allowed Downtime: <strong className="text-slate-900 dark:text-white">{calculateDowntimeBudget(settings.slaTargetPercent ?? 99.9)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="90"
              max="99.99"
              step="0.01"
              value={settings.slaTargetPercent ?? 99.9}
              onChange={(e) => onChange('slaTargetPercent', Number(e.target.value))}
              className="flex-1 accent-emerald-500 cursor-pointer"
            />
            <input
              type="number"
              step="0.01"
              min="50"
              max="100"
              value={settings.slaTargetPercent ?? 99.9}
              onChange={(e) => onChange('slaTargetPercent', Number(e.target.value))}
              className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {slaPresets.map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => onChange('slaTargetPercent', p.val)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  settings.slaTargetPercent === p.val
                    ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-emerald-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Logo URL */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Custom Logo URL (Optional)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={settings.reportLogoUrl || ''}
              onChange={(e) => onChange('reportLogoUrl', e.target.value)}
              placeholder="https://example.com/logo.png"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            {settings.reportLogoUrl && (
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={settings.reportLogoUrl}
                  alt="Logo Preview"
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Custom corporate logo applied to exported PDF reports and customer invoices.
          </p>
        </div>

        {/* Audit Log Retention Days */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Audit Trail Data Retention
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="7"
              max="730"
              value={settings.auditRetentionDays || 90}
              onChange={(e) => onChange('auditRetentionDays', Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <span className="text-xs font-mono text-slate-500 shrink-0">Days</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Automatic prune threshold for historical ping telemetry and event logs.
          </p>
        </div>
      </div>
    </div>
  );
}
