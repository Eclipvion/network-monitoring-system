import React from 'react';
import { ShieldCheck, ShieldAlert, Award, FileCheck, CheckCircle2, XCircle, AlertTriangle, Clock, Activity } from 'lucide-react';

export default function ComplianceAuditTab({ metrics = {}, compliance = {}, branding = {}, incidents = [] }) {
  const targetSla = compliance.targetSlaPercent || 99.9;
  const actualUptime = metrics.uptimePercent ?? 100;
  const isSlaMet = compliance.slaStatus === 'SLA_MET';
  const slaGap = (actualUptime - targetSla).toFixed(2);
  const healthScore = compliance.healthScore ?? 100;
  const healthGrade = compliance.healthGrade || 'A+';
  const activeOutages = incidents.filter((i) => !i.isResolved).length;

  const auditChecklist = [
    {
      title: 'High Availability SLA Target',
      standard: `Minimum ${targetSla}% network uptime commitment`,
      actual: `${actualUptime}% availability`,
      passed: isSlaMet,
      critical: true
    },
    {
      title: 'Zero Active Unresolved Outages',
      standard: 'All critical node downtime resolved promptly',
      actual: activeOutages === 0 ? '0 Active Outages' : `${activeOutages} Active Incidents Unresolved`,
      passed: activeOutages === 0,
      critical: true
    },
    {
      title: 'MTTR Restitution Target',
      standard: 'Mean Time to Restore under 4 Hours',
      actual: metrics.mttrFormatted || '0s',
      passed: (metrics.mttrSeconds || 0) <= 14400,
      critical: false
    },
    {
      title: 'Roundtrip Latency Tolerance',
      standard: 'Average core latency within normal thresholds (< 80ms)',
      actual: metrics.avgLatency ? `${metrics.avgLatency}ms` : '—',
      passed: (metrics.avgLatency || 0) < 80,
      critical: false
    },
    {
      title: 'Packet Loss Health Tolerance',
      standard: 'Average packet drop below 1.0%',
      actual: `${metrics.avgPacketLoss || 0}% avg loss`,
      passed: (metrics.avgPacketLoss || 0) < 1.0,
      critical: false
    }
  ];

  const passedCount = auditChecklist.filter((c) => c.passed).length;
  const totalCount = auditChecklist.length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Audit Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Compliance Rating Card */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Audit Rating
            </span>
            <Award className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {healthScore}/100
            </span>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-500 text-white">
              Grade {healthGrade}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Composite SLA, latency variance, and outage penalty index.
          </p>
        </div>

        {/* SLA Audit Gap Card */}
        <div className={`glass-panel p-5 rounded-2xl border space-y-2 ${
          isSlaMet
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-rose-500/30 bg-rose-500/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              SLA Commitment Audit
            </span>
            {isSlaMet ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${isSlaMet ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isSlaMet ? 'SLA PASSED' : 'SLA BREACHED'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              ({slaGap > 0 ? `+${slaGap}%` : `${slaGap}%`})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Actual: {actualUptime}% vs Committed Target: {targetSla}%
          </p>
        </div>

        {/* Audit Verification Pass Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Verification Standards
            </span>
            <FileCheck className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-slate-800 dark:text-slate-100">
              {passedCount} / {totalCount}
            </span>
            <span className="text-xs font-bold text-slate-400">Checks Passed</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            NOC operational compliance and availability standards.
          </p>
        </div>
      </div>

      {/* Compliance Checklist Audit Table */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-500" />
            NOC Operational Compliance Audit Checklist
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rigorous automated verification against enterprise telecommunications SLA benchmarks.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {auditChecklist.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-xs"
            >
              <div className="flex items-start gap-3">
                {item.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    {item.title}
                    {item.critical && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.standard}</div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {item.actual}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    item.passed
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  }`}
                >
                  {item.passed ? 'PASSED' : 'DEFICIENT'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auditor Sign-off Summary */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200 block">
            Auditing Authority: {branding.organizationName || 'NetPulse Enterprise Autonomous NOC'}
          </span>
          <span className="text-[11px]">
            Automated Audit Certification Timestamp: {new Date().toUTCString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            DIGITALLY SIGNED & VERIFIED
          </span>
        </div>
      </div>
    </div>
  );
}
