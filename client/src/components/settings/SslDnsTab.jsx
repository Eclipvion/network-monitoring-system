import React, { useState } from 'react';
import { ShieldCheck, Globe, Server, Plus, Trash2, Clock, CheckCircle2 } from 'lucide-react';

export default function SslDnsTab({ settings, onChange }) {
  const [newResolverName, setNewResolverName] = useState('');
  const [newResolverIp, setNewResolverIp] = useState('');
  const [newDomain, setNewDomain] = useState('');

  const sslDayPresets = [7, 14, 30, 60];

  const handleAddResolver = () => {
    if (!newResolverName.trim() || !newResolverIp.trim()) return;
    const current = settings.dnsResolvers || [];
    onChange('dnsResolvers', [...current, { name: newResolverName.trim(), ip: newResolverIp.trim() }]);
    setNewResolverName('');
    setNewResolverIp('');
  };

  const handleRemoveResolver = (index) => {
    const current = settings.dnsResolvers || [];
    onChange('dnsResolvers', current.filter((_, i) => i !== index));
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const current = settings.dnsTestDomains || [];
    const formatted = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!current.includes(formatted)) {
      onChange('dnsTestDomains', [...current, formatted]);
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain) => {
    const current = settings.dnsTestDomains || [];
    onChange('dnsTestDomains', current.filter(d => d !== domain));
  };

  return (
    <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          SSL Expiration Alerts & DNS Sensor Configuration
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure proactive SSL certificate expiration warning limits and benchmark upstream DNS resolvers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* SSL Warning Threshold */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              SSL Expiry Warning Threshold
            </label>
            <span className="font-mono text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
              {settings.sslWarningDaysThreshold || 14} Days
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="3"
              max="90"
              value={settings.sslWarningDaysThreshold || 14}
              onChange={(e) => onChange('sslWarningDaysThreshold', Number(e.target.value))}
              className="flex-1 accent-emerald-500 cursor-pointer"
            />
            <input
              type="number"
              min="1"
              max="180"
              value={settings.sslWarningDaysThreshold || 14}
              onChange={(e) => onChange('sslWarningDaysThreshold', Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {sslDayPresets.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChange('sslWarningDaysThreshold', days)}
                className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-all ${
                  (settings.sslWarningDaysThreshold || 14) === days
                    ? 'bg-emerald-500 text-white border-emerald-500 font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-emerald-500'
                }`}
              >
                {days} Days Prior
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Triggers proactive warning alerts when monitored HTTPS domains have fewer than this many days before expiry.
          </p>
        </div>

        {/* DNS Telemetry Query Interval */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-500" />
              DNS Resolution Check Interval
            </label>
            <span className="font-mono text-xs font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded">
              {settings.dnsCheckIntervalSeconds || 300}s
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="30"
              max="900"
              step="30"
              value={settings.dnsCheckIntervalSeconds || 300}
              onChange={(e) => onChange('dnsCheckIntervalSeconds', Number(e.target.value))}
              className="flex-1 accent-cyan-500 cursor-pointer"
            />
            <input
              type="number"
              min="15"
              max="3600"
              value={settings.dnsCheckIntervalSeconds || 300}
              onChange={(e) => onChange('dnsCheckIntervalSeconds', Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {[60, 120, 300, 600].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChange('dnsCheckIntervalSeconds', sec)}
                className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-all ${
                  (settings.dnsCheckIntervalSeconds || 300) === sec
                    ? 'bg-cyan-500 text-white border-cyan-500 font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-cyan-500'
                }`}
              >
                {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Cadence for periodic DNS latency and resolver benchmark tests.
          </p>
        </div>
      </div>

      {/* Upstream Resolvers List */}
      <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-blue-500" />
            Configured DNS Resolvers for Latency Benchmarks
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {(settings.dnsResolvers || []).map((res, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-sm"
            >
              <span className="font-semibold text-slate-800 dark:text-white">{res.name}</span>
              <span className="font-mono text-slate-400 text-[11px]">({res.ip})</span>
              <button
                type="button"
                onClick={() => handleRemoveResolver(idx)}
                className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                title="Remove resolver"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={newResolverName}
            onChange={(e) => setNewResolverName(e.target.value)}
            placeholder="Name (e.g. OpenDNS)"
            className="w-36 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <input
            type="text"
            value={newResolverIp}
            onChange={(e) => setNewResolverIp(e.target.value)}
            placeholder="IP (e.g. 208.67.222.222)"
            className="w-44 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            type="button"
            onClick={handleAddResolver}
            disabled={!newResolverName || !newResolverIp}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-40"
          >
            <Plus className="w-3 h-3" />
            <span>Add Resolver</span>
          </button>
        </div>
      </div>
    </div>
  );
}
