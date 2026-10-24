import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Zap,
  Eye,
  CheckCircle2,
  XCircle,
  Server,
  Wifi,
  Laptop,
  Smartphone,
  Cpu
} from 'lucide-react';
import api from '../../services/api';

function getNodeIcon(type, isGateway) {
  if (isGateway) return Wifi;
  const t = String(type || '').toLowerCase();
  if (t.includes('router') || t.includes('gateway')) return Wifi;
  if (t.includes('mobile') || t.includes('phone')) return Smartphone;
  if (t.includes('workstation') || t.includes('pc') || t.includes('laptop')) return Laptop;
  if (t.includes('server')) return Server;
  return Cpu;
}

export default function TopologyInspector({
  selectedNode,
  onClose,
  onOpenDetails,
  onPingCompleted
}) {
  const [copied, setCopied] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  if (!selectedNode) return null;

  const Icon = getNodeIcon(selectedNode.type, selectedNode.isGateway);

  const handleCopyIp = (e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(selectedNode.ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleInstantPing = async () => {
    setPinging(true);
    setPingResult(null);

    try {
      // 1. Run live connection probe directly on node's IP
      const testRes = await api.testPing(selectedNode.ip);

      const isUp = testRes.status === 'UP' || testRes.success;
      const latencyVal = testRes.latency ?? 2;

      setPingResult({
        success: isUp,
        latency: latencyVal,
        method: testRes.method || 'Smart Probe',
        message: testRes.message || (isUp ? `Connected successfully (${latencyVal}ms)` : 'Host unreachable (Timeout)')
      });

      // 2. If node has a numeric database ID, also trigger pingNow to update database monitoring history
      const targetDbId = selectedNode.deviceId || selectedNode.id;
      if (targetDbId && (typeof targetDbId === 'number' || (typeof targetDbId === 'string' && /^\d+$/.test(targetDbId)))) {
        try {
          await api.pingNow(targetDbId);
          if (onPingCompleted) onPingCompleted();
        } catch (_) {}
      }
    } catch (err) {
      setPingResult({
        success: false,
        latency: null,
        method: 'Network Error',
        message: err.message || 'Connection test failed'
      });
    } finally {
      setPinging(false);
    }
  };

  // Display status and latency (prioritizing fresh test result if available)
  const currentStatus = pingResult ? (pingResult.success ? 'UP' : 'DOWN') : selectedNode.status;
  const currentLatency = pingResult
    ? (pingResult.latency ? `${pingResult.latency} ms` : 'Timeout')
    : (selectedNode.status === 'DOWN' ? 'Timeout' : `${selectedNode.latestResult?.latency || selectedNode.latency || 12} ms`);

  return (
    <div className="absolute top-4 right-4 w-80 sm:w-96 rounded-2xl bg-slate-900/98 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-5 text-slate-200 z-40 animate-in fade-in slide-in-from-right-4 duration-200 cursor-default pointer-events-auto select-auto">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Icon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white truncate max-w-[170px]" title={selectedNode.name}>
              {selectedNode.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-xs text-slate-400">{selectedNode.ip}</span>
              <button
                onClick={handleCopyIp}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                title="Copy IP"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <span className="text-[11px] text-slate-400">Node Status</span>
          <p className="font-bold font-mono mt-0.5 text-white flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                currentStatus === 'DOWN'
                  ? 'bg-rose-500'
                  : currentStatus === 'WARNING'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            {currentStatus}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <span className="text-[11px] text-slate-400">Response Latency</span>
          <p className="font-bold font-mono mt-0.5 text-white">
            {currentLatency}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <span className="text-[11px] text-slate-400">Device Role</span>
          <p className="font-bold mt-0.5 text-white">
            {selectedNode.isGateway ? '⚡ Core Router' : '📱 Connected Host'}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <span className="text-[11px] text-slate-400">Device Category</span>
          <p className="font-bold capitalize mt-0.5 text-white">
            {selectedNode.type || 'Host'}
          </p>
        </div>
      </div>

      {/* Live Ping Verification Result */}
      {pingResult && (
        <div
          className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
            pingResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {pingResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{pingResult.message}</p>
            {pingResult.method && (
              <span className="text-[10px] text-slate-400 font-mono">Verified via: {pingResult.method}</span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 space-y-2">
        <button
          onClick={handleInstantPing}
          disabled={pinging}
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
        >
          <Zap className={`w-3.5 h-3.5 ${pinging ? 'animate-spin' : ''}`} />
          <span>{pinging ? 'Testing Live Connection...' : '⚡ Test Live Connection Now'}</span>
        </button>

        {onOpenDetails && (
          <button
            onClick={(e) => {
              e?.stopPropagation();
              const targetId = selectedNode.deviceId || selectedNode.id;
              if (targetId) {
                onOpenDetails(targetId);
              }
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600 transition-all shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>View Historical Diagnostics</span>
          </button>
        )}
      </div>
    </div>
  );
}
