import React from 'react';

export default function SpeedometerGauge({
  value = 0,
  max = 1000,
  label = 'Download',
  unit = 'Mbps',
  isActive = false,
  color = '#10b981'
}) {
  // Angle range: -120 deg (0) to +120 deg (max)
  const clamped = Math.min(Math.max(value, 0), max);
  // Logarithmic scale feel for 0 to 1000 to highlight lower & higher speeds nicely
  const pct = Math.min(Math.max(clamped / max, 0), 1);
  const angle = -120 + pct * 240;

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      {/* SVG Arc Gauge */}
      <div className="relative w-48 h-32 flex items-center justify-center overflow-visible">
        <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="gaugeTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Arc (Radius 80, Center 100, 100) */}
          <path
            d="M 25 100 A 75 75 0 1 1 175 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-slate-200 dark:text-slate-800"
          />

          {/* Active Gradient Arc */}
          <path
            d="M 25 100 A 75 75 0 1 1 175 100"
            fill="none"
            stroke="url(#gaugeTrackGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="235.6"
            strokeDashoffset={235.6 - (235.6 * pct)}
            className="transition-all duration-300 ease-out"
            filter="url(#glow)"
          />

          {/* Needle Center Pivot */}
          <circle cx="100" cy="100" r="8" className="fill-slate-700 dark:fill-slate-300" />
          <circle cx="100" cy="100" r="4" fill={color} className={isActive ? 'animate-ping' : ''} />

          {/* Needle Arm */}
          <g transform={`rotate(${angle} 100 100)`} className="transition-transform duration-300 ease-out">
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="34"
              stroke={color}
              strokeWidth="3.5"
              strokeLinecap="round"
              filter="url(#glow)"
            />
          </g>
        </svg>

        {/* Needle Value Badge Overlay */}
        <div className="absolute bottom-0 text-center flex flex-col items-center">
          <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
            {clamped.toFixed(1)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-0.5">
            {unit}
          </span>
        </div>
      </div>

      {/* Label & Status */}
      <div className="mt-2 text-center">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
          {isActive && <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: color }} />}
          {label}
        </span>
      </div>
    </div>
  );
}
