import React from 'react';
import {
  Crosshair,
  ShieldAlert,
  Power,
  Trash2,
  Copy,
  Terminal,
  Server
} from 'lucide-react';

export default function HoneypotSensorTab({
  honeypotStatus,
  honeypotLoading,
  honeypotPortInput,
  setHoneypotPortInput,
  honeypotServiceSelect,
  setHoneypotServiceSelect,
  honeypotSimulating,
  handleSimulateProbe,
  handleToggleHoneypot,
  handleSaveHoneypotConfig,
  handleClearHoneypotLogs,
  handleCopyText,
  setSelectedAttackerBan
}) {
  const recentHits = honeypotStatus?.recentHits || [];

  return (
    <div className="space-y-4">
      {/* Honeypot Control & Status Command Deck */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-2xl shrink-0 ${
              honeypotStatus?.running
                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <Crosshair className={`w-6 h-6 ${honeypotStatus?.running ? 'animate-pulse text-amber-500' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Decoy Honeypot & Port Scan Intrusion Sensor
                </h3>
                {honeypotStatus?.running ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-mono flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE LISTENER (0.0.0.0:{honeypotStatus?.port})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                    SENSOR PAUSED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Opens an in-memory decoy port that traps unauthorized network scanners, lateral movers, and brute-force bots the moment they connect.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            <button
              onClick={handleSimulateProbe}
              disabled={honeypotSimulating || !honeypotStatus?.running}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Simulate an attacker probe locally to verify the sensor catches intrusions live"
            >
              <Crosshair className={`w-3.5 h-3.5 ${honeypotSimulating ? 'animate-spin' : ''}`} />
              <span>{honeypotSimulating ? 'Probing...' : 'Simulate Intruder Probe'}</span>
            </button>

            <button
              onClick={handleToggleHoneypot}
              disabled={honeypotLoading}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                honeypotStatus?.running
                  ? 'bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{honeypotStatus?.running ? 'Pause Sensor' : 'Activate Sensor'}</span>
            </button>

            {honeypotStatus?.stats?.totalHits > 0 && (
              <button
                onClick={handleClearHoneypotLogs}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Clear intrusion hit logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Config inputs toolbar (Responsive Flex) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Decoy Port:</span>
              <input
                type="number"
                min="1024"
                max="65535"
                value={honeypotPortInput}
                onChange={(e) => setHoneypotPortInput(e.target.value)}
                className="w-20 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Profile:</span>
              <select
                value={honeypotServiceSelect}
                onChange={(e) => setHoneypotServiceSelect(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="ssh">SSH (OpenSSH 8.9 Decoy)</option>
                <option value="telnet">Telnet (Cisco Router Decoy)</option>
                <option value="http">HTTP (Apache Web Admin Decoy)</option>
                <option value="ftp">FTP (vsFTPd 3.0 Decoy)</option>
                <option value="silent">Silent Sniffer (No Banner)</option>
              </select>
            </div>

            <button
              onClick={handleSaveHoneypotConfig}
              disabled={honeypotLoading}
              className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Apply Config
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Recommend: <strong>2222</strong> (SSH), <strong>2323</strong> (Telnet), <strong>8088</strong> (HTTP)
          </div>
        </div>
      </div>

      {/* Tri-Panel KPI for Honeypot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Intrusions Intercepted
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${
              honeypotStatus?.stats?.totalHits > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'
            }`}>
              {honeypotStatus?.stats?.totalHits || 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">probes caught</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Probes on port {honeypotStatus?.port} trigger auto-incidents
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Unique Rogue Scanner IPs
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${
              honeypotStatus?.stats?.uniqueAttackerIps > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'
            }`}>
              {honeypotStatus?.stats?.uniqueAttackerIps || 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">adversary hosts</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Distinct endpoints caught performing port scans
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 shadow-sm sm:col-span-2 md:col-span-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Active Sensor Profile
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white uppercase font-mono">
              {honeypotStatus?.emulatedService || 'SSH'}
            </span>
            <span className="text-xs text-slate-400 font-mono">Port {honeypotStatus?.port || 2222}</span>
          </div>
          <p className="text-[11px] text-emerald-500 font-medium">
            {honeypotStatus?.running ? '✓ Trapping scans & recording payloads' : 'Sensor is paused'}
          </p>
        </div>
      </div>

      {/* Captured Intrusion Events Table: Desktop View */}
      <div className="hidden sm:block rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Live Intruder Radar Log ({recentHits.length} Recent Events)
            </h4>
            <p className="text-xs text-slate-400">
              Packet payload captures and 1-click firewall ban rules for detected intruders
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Attacker IP & Port</th>
                <th className="py-3 px-4">Target Decoy</th>
                <th className="py-3 px-4">Detected Signature</th>
                <th className="py-3 px-4">Captured Payload Snippet</th>
                <th className="py-3 px-4 text-right">Defense Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {recentHits.map((hit) => (
                <tr
                  key={hit.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors bg-amber-500/5"
                >
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {new Date(hit.timestamp).toLocaleTimeString()}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-500">{hit.attackerIp}</span>
                      <span className="text-slate-400 font-normal">:{hit.attackerPort}</span>
                      <button
                        onClick={() => handleCopyText(hit.attackerIp)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Copy Attacker IP"
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                      Port {hit.targetPort} ({hit.emulatedService?.toUpperCase()})
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                      {hit.probeType}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {hit.payloadSnippet}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedAttackerBan(hit)}
                      className="px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ml-auto shadow-xs"
                      title="Generate firewall ban rule for this attacker"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>Ban Attacker</span>
                    </button>
                  </td>
                </tr>
              ))}

              {recentHits.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 text-xs">
                    <Crosshair className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No intruder probes detected yet.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Simulate Intruder Probe" above to test the sensor live!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Captured Intrusion Events: Mobile Cards (< sm) */}
      <div className="sm:hidden space-y-2.5">
        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider px-1">
          Intruder Radar Hits ({recentHits.length})
        </h4>
        {recentHits.map((hit) => (
          <div
            key={hit.id}
            className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2 text-xs shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="text-rose-500">{hit.attackerIp}</span>
                <span className="text-slate-400 font-normal">:{hit.attackerPort}</span>
                <button onClick={() => handleCopyText(hit.attackerIp)} className="text-slate-400">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(hit.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold text-[10px]">
                {hit.probeType}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 font-bold text-[10px] font-mono">
                Port {hit.targetPort}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-950 font-mono text-[10px] text-slate-300 break-all">
              {hit.payloadSnippet}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setSelectedAttackerBan(hit)}
                className="w-full py-1.5 rounded-lg bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Ban Attacker IP</span>
              </button>
            </div>
          </div>
        ))}

        {recentHits.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            No intruder probes detected yet.
          </div>
        )}
      </div>
    </div>
  );
}
