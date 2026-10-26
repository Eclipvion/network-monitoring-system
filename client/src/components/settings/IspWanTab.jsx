import React, { useState } from 'react';
import { Globe, RefreshCw, Copy, Check, Server, ArrowUpRight, Shield } from 'lucide-react';
import api from '../../services/api';

export default function IspWanTab({ settings, onChange, onSetBulk }) {
  const [detecting, setDetecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleAutoDetect = async () => {
    try {
      setDetecting(true);
      setFeedback(null);
      const res = await api.getPublicIp();
      if (res.ip && res.ip !== 'Unknown') {
        onSetBulk({
          ispPublicIp: res.ip,
          ispName: res.isp || settings.ispName || '',
          ispPool: res.poolSuggestion || settings.ispPool || `${res.ip}/24`
        });
        setFeedback({ success: true, message: `Auto-detected WAN IP: ${res.ip} (${res.isp || 'Carrier Detected'})` });
      } else {
        setFeedback({ success: false, message: 'Could not auto-detect Public IP. Enter manually below.' });
      }
    } catch (e) {
      setFeedback({ success: false, message: `Detection error: ${e.message}` });
    } finally {
      setDetecting(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestGateway = async () => {
    if (!settings.ispGatewayIp) return;
    try {
      setPingTesting(true);
      setPingResult(null);
      const res = await api.testPing(settings.ispGatewayIp);
      const isAlive = Boolean(res.alive ?? (res.success && res.status !== 'DOWN'));
      const latency = res.latency !== undefined ? res.latency : (res.time !== undefined ? res.time : null);
      const method = res.method ? ` (${res.method})` : '';

      setPingResult({
        alive: isAlive,
        latency,
        method: res.method || '',
        message: isAlive
          ? `Gateway reachable! ${latency !== null ? `${latency} ms` : 'Active'}${method}`
          : (res.message || 'Gateway unreachable / timed out')
      });
    } catch (e) {
      setPingResult({ alive: false, message: `Ping failed: ${e.message}` });
    } finally {
      setPingTesting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl glass-panel space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-500" />
            ISP Internet & Public WAN IP Pool Configuration
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure upstream carrier details, static public IP, and gateway hop to power live WAN health telemetry.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAutoDetect}
          disabled={detecting}
          className="px-4 py-2 rounded-xl text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${detecting ? 'animate-spin' : ''}`} />
          <span>{detecting ? 'Detecting WAN...' : '⚡ Auto-Detect WAN & ISP'}</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-semibold ${
          feedback.success
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
        }`}>
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* ISP Public WAN IP */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            ISP Public WAN IP Address
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={settings.ispPublicIp || ''}
              onChange={(e) => onChange('ispPublicIp', e.target.value)}
              placeholder="e.g. 59.103.117.3"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(settings.ispPublicIp)}
              disabled={!settings.ispPublicIp}
              title="Copy IP"
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Visible egress IPv4 address assigned to your perimeter router.
          </p>
        </div>

        {/* ISP Carrier Name */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            ISP Provider / Carrier Brand
          </label>
          <input
            type="text"
            value={settings.ispName || ''}
            onChange={(e) => onChange('ispName', e.target.value)}
            placeholder="e.g. PTCL, Nayatel, StormFiber, Transworld, Optix"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <p className="text-[11px] text-slate-400">
            Carrier label highlighted on the NOC executive WAN badge.
          </p>
        </div>

        {/* ISP Gateway IP */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            ISP WAN Gateway Hop (Next Hop Router)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={settings.ispGatewayIp || ''}
              onChange={(e) => onChange('ispGatewayIp', e.target.value)}
              placeholder="e.g. 172.18.1.1 or 59.103.117.1"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button
              type="button"
              onClick={handleTestGateway}
              disabled={pingTesting || !settings.ispGatewayIp}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all disabled:opacity-40 shrink-0"
            >
              {pingTesting ? 'Pinging...' : 'Ping Test'}
            </button>
          </div>
          {pingResult && (
            <div className={`p-2.5 rounded-xl text-xs font-mono flex items-center justify-between border animate-in fade-in duration-150 ${
              pingResult.alive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
            }`}>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className={`w-2 h-2 rounded-full shrink-0 ${pingResult.alive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {pingResult.message}
              </span>
              {pingResult.alive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 shrink-0">
                  ONLINE
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Upstream optical node / ISP POP router address.
          </p>
        </div>

        {/* Public CIDR Pool */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Public Subnet CIDR Pool / Block
          </label>
          <input
            type="text"
            value={settings.ispPool || ''}
            onChange={(e) => onChange('ispPool', e.target.value)}
            placeholder="e.g. 59.103.117.0/24 or 39.45.12.32/29"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <p className="text-[11px] text-slate-400">
            Allocated enterprise IP subnet range for your primary site uplink.
          </p>
        </div>
      </div>
    </div>
  );
}
