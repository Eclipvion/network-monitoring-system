import React from 'react';

export default function StatusBadge({ status, pulse = true, size = 'md' }) {
  const normStatus = (status || 'UNKNOWN').toUpperCase();

  let bgClass = 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  let dotClass = 'bg-slate-400';
  let pulseClass = '';

  if (normStatus === 'UP') {
    bgClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    dotClass = 'bg-emerald-500';
    pulseClass = 'bg-emerald-400';
  } else if (normStatus === 'DOWN') {
    bgClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    dotClass = 'bg-rose-500';
    pulseClass = 'bg-rose-400';
  } else if (normStatus === 'WARNING') {
    bgClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    dotClass = 'bg-amber-500';
    pulseClass = 'bg-amber-400';
  } else if (normStatus === 'PAUSED') {
    bgClass = 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
    dotClass = 'bg-slate-400';
  } else if (normStatus === 'PENDING') {
    bgClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    dotClass = 'bg-blue-500';
    pulseClass = 'bg-blue-400';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-semibold px-2.5 py-1',
    lg: 'text-sm font-semibold px-3 py-1.5'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${bgClass} ${sizeClasses[size] || sizeClasses.md}`}>
      <span className="relative flex h-2 w-2">
        {pulse && (normStatus === 'UP' || normStatus === 'DOWN' || normStatus === 'WARNING') && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseClass}`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`}></span>
      </span>
      <span>{normStatus}</span>
    </span>
  );
}
