import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Globe,
  Clock,
  Tag,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  MapPin
} from 'lucide-react';
import api from '../services/api';

export default function DeviceModal({ isOpen, onClose, onSave, device = null, defaultInterval = 30 }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [type, setType] = useState('server');
  const [group, setGroup] = useState('Default');
  const [protocol, setProtocol] = useState('auto'); // 'auto', 'icmp', 'tcp'
  const [customPort, setCustomPort] = useState('');
  const [interval, setInterval] = useState(defaultInterval);
  const [monitoring, setMonitoring] = useState(true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name || '');
      setIp(device.ip || '');
      setType(device.type || 'server');
      setGroup(device.group || 'Default');
      setInterval(device.interval || defaultInterval);
      setMonitoring(device.monitoring !== undefined ? device.monitoring : true);

      // Check if device has port
      if (device.ip && device.ip.includes(':')) {
        const parts = device.ip.split(':');
        setCustomPort(parts[1] || '');
        setProtocol('tcp');
      } else {
        setCustomPort('');
        setProtocol('auto');
      }
    } else {
      setName('');
      setIp('');
      setType('server');
      setGroup('Default');
      setProtocol('auto');
      setCustomPort('');
      setInterval(defaultInterval);
      setMonitoring(true);
    }
    setError('');
    setTestResult(null);
  }, [device, defaultInterval, isOpen]);

  if (!isOpen) return null;

  // Target validation
  const isValidTarget = (val) => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    const hostPortMatch = trimmed.match(/^([^:]+):(\d+)$/);
    let host = trimmed;
    if (hostPortMatch) {
      host = hostPortMatch[1];
      const port = parseInt(hostPortMatch[2], 10);
      if (port < 1 || port > 65535) return false;
    }
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const hostnameRegex = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*$/;
    return ipv4Regex.test(host) || ipv6Regex.test(host) || hostnameRegex.test(host);
  };

  const handleTestConnection = async () => {
    if (!ip.trim() || !isValidTarget(ip.trim())) {
      setError('Please enter a valid IP address or hostname first.');
      return;
    }
    setError('');
    setTesting(true);
    setTestResult(null);

    try {
      let targetToTest = ip.trim();
      let portToTest = customPort ? Number(customPort) : null;
      if (protocol === 'tcp' && !portToTest && !targetToTest.includes(':')) {
        portToTest = 443;
      }

      const res = await api.testPing(targetToTest, portToTest, protocol);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        status: 'DOWN',
        message: err.message || 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a valid device name.');
      return;
    }

    let finalIp = ip.trim();
    if (!finalIp || !isValidTarget(finalIp)) {
      setError('Please enter a valid IP address, Hostname, or Host:Port.');
      return;
    }

    // Attach custom port if TCP protocol selected and not already in IP
    if (protocol === 'tcp' && customPort && !finalIp.includes(':')) {
      finalIp = `${finalIp}:${customPort}`;
    }

    if (Number(interval) < 5) {
      setError('Ping interval must be at least 5 seconds.');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        ip: finalIp,
        type,
        group: group.trim() || 'Default',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {device ? 'Edit Monitored Device' : 'Add Monitored Device'}
              </h3>
              <p className="text-[11px] text-slate-400">Configure host, monitoring method, and telemetry interval</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Device Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Device Name
            </label>
            <input
              type="text"
              placeholder="e.g. Core Switch, Azure Storage, Attendance PC"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* IP / Hostname Input + Test Ping Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                IP Address / Hostname
              </label>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !ip.trim()}
                className="text-[11px] font-semibold text-emerald-500 hover:text-emerald-600 flex items-center gap-1 disabled:opacity-40 transition-colors"
              >
                <Zap className={`w-3 h-3 ${testing ? 'animate-bounce text-amber-500' : ''}`} />
                {testing ? 'Testing Connection...' : '⚡ Test Connection'}
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 172.18.1.5, 57.150.61.1:443, or google.com"
                value={ip}
                onChange={(e) => {
                  setIp(e.target.value);
                  setTestResult(null);
                }}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Test Connection Result Box */}
            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.latency !== null && (
                  <span className="font-mono font-bold">{testResult.latency} ms</span>
                )}
              </div>
            )}
          </div>

          {/* Protocol Method Selector */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monitoring Method & Protocol
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProtocol('auto')}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                  protocol === 'auto'
                    ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Auto (ICMP + TCP)
              </button>
              <button
                type="button"
                onClick={() => setProtocol('icmp')}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                  protocol === 'icmp'
                    ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                ICMP Ping
              </button>
              <button
                type="button"
                onClick={() => setProtocol('tcp')}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                  protocol === 'tcp'
                    ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                TCP Port Ping
              </button>
            </div>

            {/* Quick Port Presets if TCP */}
            {protocol === 'tcp' && (
              <div className="pt-1.5 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Port Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '443 (HTTPS/Azure)', port: '443' },
                      { label: '80 (HTTP)', port: '80' },
                      { label: '22 (SSH)', port: '22' },
                      { label: '3389 (RDP)', port: '3389' },
                      { label: '53 (DNS)', port: '53' }
                    ].map((p) => (
                      <button
                        key={p.port}
                        type="button"
                        onClick={() => setCustomPort(p.port)}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                          customPort === p.port
                            ? 'bg-emerald-500 text-white font-bold'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Device Type & Group / Location */}
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
                Location / Group
              </label>
              <input
                type="text"
                placeholder="e.g. Local Network, Azure, HQ"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Interval */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Probe Interval (Seconds)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="5"
                max="3600"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                required
                className="w-32 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <div className="flex items-center gap-1.5">
                {[10, 15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setInterval(sec)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                      Number(interval) === sec
                        ? 'bg-emerald-500 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Monitoring Toggle */}
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
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              {loading ? 'Saving...' : device ? 'Update Device' : 'Save & Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
