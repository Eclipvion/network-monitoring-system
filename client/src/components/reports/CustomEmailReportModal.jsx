import React, { useState, useEffect } from 'react';
import {
  Mail,
  X,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
  FileText,
  Shield,
  Radio,
  Check
} from 'lucide-react';
import api from '../../services/api';

/**
 * CustomEmailReportModal
 * Universal interactive modal allowing NOC engineers to dispatch any report
 * directly & exclusively to one or more custom recipient email addresses on-the-fly.
 */
export default function CustomEmailReportModal({
  isOpen,
  onClose,
  reportTitle = 'Email Report',
  reportSubtitle = 'Direct & exclusive delivery to custom recipient',
  reportScope = 'All Monitored Systems',
  scopeBadge = 'Executive NOC',
  gradient = 'from-indigo-500 to-cyan-600',
  icon: CustomIcon = null,
  onSend,
  onSuccess
}) {
  const [recipientInput, setRecipientInput] = useState('');
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Auto-fetch saved email recipients when opened to supply quick-select chips
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      return;
    }

    let isMounted = true;
    const loadConfiguredRecipients = async () => {
      try {
        const cfg = await api.getEmailReportConfig().catch(() => null);
        if (cfg && isMounted) {
          const list = Array.isArray(cfg.recipientList)
            ? cfg.recipientList.map((r) => (typeof r === 'string' ? r : r.email))
            : typeof cfg.recipients === 'string'
              ? cfg.recipients.split(',').map((e) => e.trim())
              : [];
          const unique = Array.from(new Set(list.filter((e) => e && e.includes('@'))));
          setSavedRecipients(unique);

          // Pre-populate with first configured recipient if current input is empty
          if (!recipientInput && unique.length > 0) {
            setRecipientInput(unique[0]);
          }
        }
      } catch (_) {}
    };

    loadConfiguredRecipients();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const recipient = recipientInput.trim();
    if (!recipient) {
      setErrorMessage('Please enter at least one recipient email address.');
      return;
    }

    setSending(true);
    setErrorMessage(null);

    try {
      if (typeof onSend === 'function') {
        const result = await onSend(recipient);
        if (typeof onSuccess === 'function') {
          onSuccess(result, recipient);
        }
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to dispatch email report. Please verify SMTP settings in Settings > Email Center.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#1c2940] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-tr ${gradient} shrink-0`}
            >
              {CustomIcon ? (
                <CustomIcon className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Mail className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-base truncate" title={reportTitle}>
                {reportTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {reportSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !sending && onClose()}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Scope Pill */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-200 truncate" title={typeof reportScope === 'string' ? reportScope : undefined}>
                {reportScope}
              </span>
            </div>
            {scopeBadge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                {scopeBadge}
              </span>
            )}
          </div>

          {/* Recipient Email Address Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>
                Recipient Email Address <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] font-normal lowercase text-slate-400">
                comma-separated allowed
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                value={recipientInput}
                onChange={(e) => {
                  setRecipientInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. manager@company.com or audit@netpulse.local"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Quick Select Chips from Configured Emails */}
          {savedRecipients.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Quick-select from configured recipients:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {savedRecipients.map((rec) => (
                  <button
                    type="button"
                    key={rec}
                    onClick={() => setRecipientInput(rec)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      recipientInput === rec
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {rec}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-bold">Email Dispatch Error:</strong>
                <p className="text-[11px] leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Exclusive Delivery Notice */}
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-2.5 text-xs text-cyan-900 dark:text-cyan-200">
            <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block font-bold">🔒 Exclusive Direct Recipient Delivery:</strong>
              <p className="text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-300">
                Yeh report <strong>sirf upar likhe gaye recipient email</strong> ko send hogi.
                Company ki kisi aur mailing list ya dusre team members ko deliver nahi hogi.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={sending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !recipientInput.trim()}
              className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 bg-gradient-to-r ${gradient}`}
            >
              {sending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email Now</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

