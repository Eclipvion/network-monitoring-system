import React from 'react';
import {
  Wifi,
  Smartphone,
  Laptop,
  Server,
  Cpu,
  Zap,
  Activity,
  HardDrive
} from 'lucide-react';

export function parseNodeDisplay(node) {
  const rawName = String(node.name || '').trim();
  const rawIp = String(node.ip || '').trim();

  // Strip redundant trailing IP in parentheses like "(192.168.46.115)"
  let cleanName = rawName.replace(/\s*\(\s*\d+\.\d+\.\d+\.\d+(?::\d+)?\s*\)\s*$/, '').trim();

  if (!cleanName || cleanName.toLowerCase() === rawIp.toLowerCase()) {
    if (node.isGateway) {
      cleanName = 'Main Gateway / Router';
    } else if (node.type === 'mobile') {
      cleanName = 'Mobile Device';
    } else if (node.type === 'workstation') {
      cleanName = 'Workstation Host';
    } else {
      cleanName = 'Network Host';
    }
  }

  // Detect Vendor / Hardware brand
  let vendorTag = '';
  const lower = cleanName.toLowerCase();
  if (lower.includes('private wi-fi') || lower.includes('private mac')) {
    vendorTag = 'Private Wi-Fi';
  } else if (lower.includes('apple') || lower.includes('iphone') || lower.includes('ipad')) {
    vendorTag = 'Apple';
  } else if (lower.includes('samsung') || lower.includes('galaxy')) {
    vendorTag = 'Samsung';
  } else if (lower.includes('tp-link')) {
    vendorTag = 'TP-Link';
  } else if (lower.includes('huawei')) {
    vendorTag = 'Huawei';
  } else if (lower.includes('xiaomi')) {
    vendorTag = 'Xiaomi';
  } else if (lower.includes('intel')) {
    vendorTag = 'Intel';
  } else if (lower.includes('dell')) {
    vendorTag = 'Dell';
  } else if (lower.includes('hp')) {
    vendorTag = 'HP';
  } else if (node.isGateway) {
    vendorTag = 'Router';
  } else {
    vendorTag = node.type ? node.type.toUpperCase() : 'HOST';
  }

  // Highlight IP: Prefix and Host Octet
  const parts = rawIp.split('.');
  let ipPrefix = rawIp;
  let ipSuffix = '';
  if (parts.length === 4) {
    ipPrefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
    ipSuffix = parts[3];
  }

  return {
    cleanName,
    rawName,
    rawIp,
    ipPrefix,
    ipSuffix,
    vendorTag
  };
}

function getNodeIcon(type, isGateway) {
  if (isGateway) return Wifi;
  const t = String(type || '').toLowerCase();
  if (t.includes('router') || t.includes('gateway')) return Wifi;
  if (t.includes('mobile') || t.includes('phone') || t.includes('tablet')) return Smartphone;
  if (t.includes('workstation') || t.includes('pc') || t.includes('laptop') || t.includes('desktop')) return Laptop;
  if (t.includes('server')) return Server;
  return Cpu;
}

function getNodeGradient(status, isGateway) {
  if (isGateway) return 'from-emerald-500 to-teal-500 text-white shadow-emerald-500/40';
  if (status === 'UP') return 'from-emerald-500 to-teal-600 text-white shadow-emerald-500/30';
  if (status === 'WARNING') return 'from-amber-500 to-orange-600 text-white shadow-amber-500/30';
  if (status === 'DOWN') return 'from-rose-500 to-red-600 text-white shadow-rose-500/30';
  return 'from-slate-600 to-slate-700 text-slate-300';
}

export default function TopologyNode({
  node,
  isSelected,
  isDimmed,
  onClick,
  onMouseEnter,
  onMouseLeave
}) {
  const { cleanName, rawName, rawIp, ipPrefix, ipSuffix, vendorTag } = parseNodeDisplay(node);
  const Icon = getNodeIcon(node.type, node.isGateway);
  const isDown = node.status === 'DOWN';
  const isWarn = node.status === 'WARNING';
  const latency = node.latestResult?.latency ?? (node.latency ?? (isDown ? null : 12));

  // Determine whether floating tooltip shows above or below node
  const tooltipAbove = node.y > 170;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`topology-node group absolute cursor-pointer -translate-x-1/2 -translate-y-1/2 select-none z-20 hover:z-50 transition-transform duration-150 hover:scale-[1.04] ${
        isSelected ? 'z-40 scale-[1.05]' : ''
      } ${isDimmed ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}
      style={{ left: `${node.x}px`, top: `${node.y}px` }}
    >
      {/* Gateway Pulse Ring */}
      {node.isGateway && (
        <div className="absolute -inset-3 rounded-2xl bg-emerald-500/25 animate-ping opacity-60 pointer-events-none" />
      )}

      {/* Floating Interactive Hover Flyout (Pure CSS hover - Zero flickering / zero re-render) */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-slate-900/98 border border-emerald-400 shadow-2xl shadow-emerald-500/50 backdrop-blur-xl z-50 pointer-events-none transition-all duration-150 opacity-0 group-hover:opacity-100 ${
          tooltipAbove ? 'bottom-full mb-3 translate-y-1 group-hover:translate-y-0' : 'top-full mt-3 -translate-y-1 group-hover:translate-y-0'
        }`}
      >
        {/* Flyout Arrow Pointer */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-l border-t border-emerald-400 rotate-45 ${
            tooltipAbove ? '-bottom-1.5' : '-top-1.5'
          }`}
        />

        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full ${
                isDown ? 'bg-rose-500' : isWarn ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="font-bold text-xs text-white truncate max-w-[140px]">
              {cleanName}
            </span>
          </div>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
              isDown
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isDown ? 'OFFLINE' : `${latency}ms`}
          </span>
        </div>

        <div className="space-y-1 text-[11px] font-mono">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">IP Address:</span>
            <span className="font-bold text-emerald-300">{rawIp}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Hardware / Vendor:</span>
            <span className="text-slate-200">{vendorTag}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Device Type:</span>
            <span className="text-slate-200 capitalize">{node.type || 'Host'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Status:</span>
            <span className={isDown ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isDown ? 'Disconnected' : 'Active & Reachable'}
            </span>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-emerald-400/90 text-center font-sans font-medium flex items-center justify-center gap-1">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span>Click device to test connection & view details</span>
        </div>
      </div>

      {/* Main Node Card Shell */}
      <div
        className={`w-[195px] p-2.5 rounded-2xl backdrop-blur-md transition-all duration-150 border ${
          isSelected
            ? 'bg-slate-900 border-emerald-400 ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/30'
            : node.isGateway
            ? 'bg-slate-900/95 border-emerald-500/60 shadow-xl shadow-emerald-950/40 group-hover:border-emerald-400 group-hover:ring-4 group-hover:ring-emerald-400/40 group-hover:bg-slate-850 group-hover:shadow-2xl group-hover:shadow-emerald-500/40'
            : isDown
            ? 'bg-slate-900/85 border-rose-900/60 shadow-lg group-hover:border-rose-400 group-hover:ring-4 group-hover:ring-rose-400/40 group-hover:bg-slate-850'
            : 'bg-slate-900/90 border-slate-700/70 shadow-lg group-hover:border-emerald-400 group-hover:ring-4 group-hover:ring-emerald-400/40 group-hover:bg-slate-850 group-hover:shadow-2xl group-hover:shadow-emerald-500/40'
        }`}
      >
        {/* Top Row: Icon + Vendor Tag + Status Indicator */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Device Icon */}
            <div
              className={`w-7 h-7 rounded-xl bg-gradient-to-tr flex items-center justify-center shrink-0 shadow-md transition-transform ${getNodeGradient(
                node.status,
                node.isGateway
              )} group-hover:scale-110`}
            >
              <Icon className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>

            {/* Vendor / Classification Tag */}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[85px] transition-colors ${
                node.isGateway
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700/60 group-hover:bg-emerald-900/30 group-hover:text-emerald-200 group-hover:border-emerald-500/40'
              }`}
            >
              {vendorTag}
            </span>
          </div>

          {/* Live Ping & Latency Dot */}
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                isDown
                  ? 'bg-rose-500'
                  : isWarn
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span
              className={`text-[10px] font-mono font-bold ${
                isDown
                  ? 'text-rose-400'
                  : isWarn
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {isDown ? 'OFF' : `${latency}ms`}
            </span>
          </div>
        </div>

        {/* Device Name (Clear, readable, up to 2 lines) */}
        <div className="mt-1.5 px-0.5">
          <h4
            className="text-xs font-semibold leading-tight line-clamp-2 transition-colors text-slate-100 dark:text-white group-hover:text-emerald-300 group-hover:font-bold"
            title={rawName}
          >
            {cleanName}
          </h4>
        </div>

        {/* Monospace IP Address Badge with highlighted Host Octet */}
        <div className="mt-1.5 flex items-center justify-between px-2 py-0.5 rounded-lg border text-[11px] font-mono transition-colors bg-slate-950/80 border-slate-800 text-slate-300 group-hover:bg-slate-950 group-hover:border-emerald-500/50 group-hover:text-white">
          <span className="truncate max-w-[125px]">
            {ipSuffix ? (
              <>
                <span className="text-slate-400">{ipPrefix}</span>
                <span className="font-bold text-emerald-400 dark:text-emerald-300">
                  {ipSuffix}
                </span>
              </>
            ) : (
              <span className="text-emerald-400 font-bold">{rawIp}</span>
            )}
          </span>

          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
            {node.type ? node.type.slice(0, 4) : 'HOST'}
          </span>
        </div>
      </div>
    </div>
  );
}
