import React, { useState, useEffect } from 'react';
import { X, Server, Globe, Clock, Tag } from 'lucide-react';

export default function DeviceModal({ isOpen, onClose, onSave, device = null, defaultInterval = 30 }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [type, setType] = useState('server');
  const [interval, setInterval] = useState(defaultInterval);
  const [monitoring, setMonitoring] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name || '');
      setIp(device.ip || '');
      setType(device.type || 'server');
      setInterval(device.interval || defaultInterval);
      setMonitoring(device.monitoring !== undefined ? device.monitoring : true);
    } else {
      setName('');
      setIp('');
      setType('server');
      setInterval(defaultInterval);
      setMonitoring(true);
    }
    setError('');
  }, [device, defaultInterval, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // IP validation regex (IPv4 or IPv6)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!name.trim()) {
      setError('Please provide a valid device name.');
      return;
    }
    if (!ip.trim() || !ipRegex.test(ip.trim())) {
      setError('Please enter a valid IPv4 or IPv6 address (e.g. 192.168.1.1).');
      return;
    }
    if (Number(interval) < 5) {
      setError('Ping interval must be at least 5 seconds.');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        ip: ip.trim(),
        type,
        interval: Number(interval),
        monitoring
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {device ? 'Edit Monitored Device' : 'Add Monitored Device'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Device Name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. AD Server, Main Gateway"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              IP Address
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 172.18.10.7"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Device Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="server">Server</option>
                <option value="router">Router</option>
                <option value="switch">Switch</option>
                <option value="workstation">Workstation / PC</option>
                <option value="printer">Printer</option>
                <option value="gateway">Gateway</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Interval (sec)
              </label>
              <input
                type="number"
                min="5"
                max="3600"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={monitoring}
                onChange={(e) => setMonitoring(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 dark:bg-slate-800 dark:border-slate-700"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Active Monitoring Enabled
              </span>
            </label>
            <p className="text-xs text-slate-400 ml-7 mt-0.5">
              When enabled, Python monitoring engine probes this host periodically.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : (device ? 'Update Device' : 'Add Device')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
