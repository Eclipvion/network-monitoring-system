import React from 'react';
import {
  ShieldAlert,
  Terminal,
  X,
  Check,
  Copy,
  Info
} from 'lucide-react';

export default function AttackerBanModal({
  selectedAttackerBan,
  onClose,
  banOsTab,
  setBanOsTab,
  copiedBanCmd,
  handleCopyText,
  setCopiedBanCmd
}) {
  if (!selectedAttackerBan) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Adversary Isolation & Firewall Ban
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  THREAT SEVER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate instant host firewall rules to ban rogue scanner <span className="font-mono text-rose-400 font-bold">{selectedAttackerBan.attackerIp}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Intruder Dossier Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Rogue Attacker IP</span>
              <div className="font-mono font-black text-rose-500 text-sm">
                {selectedAttackerBan.attackerIp}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Source Port: {selectedAttackerBan.attackerPort}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Target Decoy</span>
              <div className="font-mono font-bold text-amber-500 text-sm">
                Port {selectedAttackerBan.targetPort}
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono">{selectedAttackerBan.emulatedService} Profile</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Attack Signature</span>
              <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                {selectedAttackerBan.probeType}
              </div>
              <span className="text-[10px] text-slate-400">{new Date(selectedAttackerBan.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Payload Snippet Box */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-500" />
              Captured Intercept Payload
            </span>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-300 text-[11px] leading-relaxed break-all">
              {selectedAttackerBan.payloadSnippet || '(Empty TCP SYN Connect Probe)'}
            </div>
          </div>

          {/* Firewall Ban Rule Generator */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-slate-900 dark:text-white font-bold text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                <span>Instant Host Ban Rule</span>
              </span>

              {/* OS Switcher */}
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-semibold">
                <button
                  onClick={() => setBanOsTab('powershell')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    banOsTab === 'powershell'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  PowerShell
                </button>
                <button
                  onClick={() => setBanOsTab('linuxUfw')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    banOsTab === 'linuxUfw'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Linux UFW
                </button>
                <button
                  onClick={() => setBanOsTab('linuxIptables')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    banOsTab === 'linuxIptables'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  iptables
                </button>
              </div>
            </div>

            <div className="relative group">
              <pre className="p-3.5 pr-24 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-w-full border border-slate-800 selection:bg-emerald-500/30">
                {banOsTab === 'powershell'
                  ? selectedAttackerBan.firewallRules?.powershell || `New-NetFirewallRule -DisplayName "NetPulse Ban ${selectedAttackerBan.attackerIp}" -Direction Inbound -RemoteAddress "${selectedAttackerBan.attackerIp}" -Action Block`
                  : banOsTab === 'linuxUfw'
                    ? selectedAttackerBan.firewallRules?.linuxUfw || `sudo ufw insert 1 deny from ${selectedAttackerBan.attackerIp} to any comment 'NetPulse Honeypot Ban'`
                    : selectedAttackerBan.firewallRules?.linuxIptables || `sudo iptables -I INPUT -s ${selectedAttackerBan.attackerIp} -j DROP -m comment --comment "NetPulse Honeypot Ban"`}
              </pre>
              <button
                onClick={() => {
                  const cmd =
                    banOsTab === 'powershell'
                      ? selectedAttackerBan.firewallRules?.powershell
                      : banOsTab === 'linuxUfw'
                        ? selectedAttackerBan.firewallRules?.linuxUfw
                        : selectedAttackerBan.firewallRules?.linuxIptables;
                  handleCopyText(cmd, setCopiedBanCmd);
                }}
                className="absolute right-2.5 top-2.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
              >
                {copiedBanCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Rule</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-700 dark:text-slate-300 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Executing this command completely cuts off all inbound traffic from <strong>{selectedAttackerBan.attackerIp}</strong> at the kernel packet filter level, rendering your host invisible to this scanner.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Threat Vector: Honeypot Decoy Trap
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
