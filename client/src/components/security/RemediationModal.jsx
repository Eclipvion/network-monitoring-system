import React from 'react';
import {
  Zap,
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  Info
} from 'lucide-react';

export default function RemediationModal({
  isOpen,
  onClose,
  remediationFormat,
  remediationData,
  remediationLoading,
  remediationCopied,
  handleChangeRemediationFormat,
  handleCopyText,
  setRemediationCopied,
  handleDownloadRemediationScript
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 shrink-0">
              <Zap className="w-6 h-6 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  1-Click Unified Network Remediation Script
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                  {remediationData?.rulesCount || 0} Rule Vectors
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically seals all detected open ports across monitored endpoints with hardened firewall rules.
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

        {/* Script Format Selector & Actions Bar (Responsive Flex) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => handleChangeRemediationFormat('powershell')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                remediationFormat === 'powershell'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Windows PowerShell (.ps1)
            </button>
            <button
              onClick={() => handleChangeRemediationFormat('bash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                remediationFormat === 'bash'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Linux UFW / iptables (.sh)
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button
              onClick={() => handleCopyText(remediationData?.script, setRemediationCopied)}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {remediationCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadRemediationScript}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {remediationFormat === 'powershell' ? '.ps1 File' : '.sh File'}</span>
            </button>
          </div>
        </div>

        {/* Script Code Viewer */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[55vh] space-y-3 bg-slate-950 font-mono text-xs">
          {remediationLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
              <p>Synthesizing hardened firewall lockdown rules...</p>
            </div>
          ) : (
            <pre className="text-emerald-400 leading-relaxed overflow-x-auto max-w-full whitespace-pre selection:bg-emerald-500/30">
              {remediationData?.script || '# No remediation rules generated'}
            </pre>
          )}
        </div>

        {/* Modal Footer Notes */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              {remediationFormat === 'powershell'
                ? 'Run in an Elevated Administrator Windows PowerShell window.'
                : 'Execute with "sudo bash <filename>.sh" on Linux.'}
            </span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors self-end sm:self-auto cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
