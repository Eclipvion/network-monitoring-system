import dataStore from './dataStore.js';

/**
 * Helper to generate an embedded SVG Latency & Packet Loss Trend Chart
 */
function renderLatencySvgChart(timeSeries = []) {
  const width = 840;
  const height = 240;
  const padding = { top: 30, right: 35, bottom: 40, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const validPoints = timeSeries.filter(p => p.latency !== null && p.latency !== undefined);
  let maxLatency = 50;
  for (const p of validPoints) {
    if (p.latency > maxLatency) maxLatency = p.latency;
  }
  // Round up maxLatency to nice round number
  maxLatency = Math.ceil(maxLatency * 1.25 / 10) * 10;
  if (maxLatency <= 0) maxLatency = 50;

  // Horizontal grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(fraction => {
    const val = Math.round(maxLatency * fraction);
    const y = padding.top + chartH - (fraction * chartH);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3 3" />
      <text x="${padding.left - 8}" y="${y + 4}" fill="#64748b" font-size="10" text-anchor="end" font-family="monospace">${val}ms</text>
    `;
  }).join('');

  // Plot latency line points and packet loss markers
  const pointsCount = timeSeries.length;
  if (pointsCount === 0) {
    return `<svg width="100%" viewBox="0 0 ${width} ${height}" class="report-chart">
      <rect width="${width}" height="${height}" fill="#f8fafc" rx="8"/>
      <text x="${width/2}" y="${height/2}" fill="#94a3b8" text-anchor="middle" font-size="14">No telemetry probe data in selected time window</text>
    </svg>`;
  }

  const stepX = chartW / Math.max(1, pointsCount - 1);
  const coords = [];
  const lossMarkers = [];
  const xLabels = [];

  const labelStep = Math.max(1, Math.floor(pointsCount / 6));

  timeSeries.forEach((pt, i) => {
    const x = padding.left + i * stepX;
    if (i % labelStep === 0 || i === pointsCount - 1) {
      xLabels.push(`
        <text x="${x}" y="${padding.top + chartH + 20}" fill="#64748b" font-size="10" text-anchor="middle" font-family="sans-serif">
          ${pt.timeLabel || ''}
        </text>
      `);
    }

    if (pt.status === 'DOWN' || (pt.packetLoss && pt.packetLoss > 0)) {
      const lossH = Math.min(chartH, Math.max(10, ((pt.packetLoss || 100) / 100) * chartH));
      const lossY = padding.top + chartH - lossH;
      lossMarkers.push(`
        <rect x="${x - 4}" y="${lossY}" width="8" height="${lossH}" fill="rgba(244, 63, 94, 0.35)" rx="2">
          <title>${pt.timeLabel}: Loss ${pt.packetLoss}% (${pt.status})</title>
        </rect>
      `);
    }

    if (pt.latency !== null && pt.latency !== undefined) {
      const y = padding.top + chartH - (Math.min(pt.latency, maxLatency) / maxLatency * chartH);
      coords.push({ x, y, latency: pt.latency, label: pt.timeLabel });
    }
  });

  let pathD = '';
  let areaD = '';
  if (coords.length > 0) {
    pathD = `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map(c => `L ${c.x} ${c.y}`).join(' ');
    areaD = `${pathD} L ${coords[coords.length - 1].x} ${padding.top + chartH} L ${coords[0].x} ${padding.top + chartH} Z`;
  }

  const dots = coords.length <= 40 ? coords.map(c => `
    <circle cx="${c.x}" cy="${c.y}" r="3" fill="#10b981" stroke="#ffffff" stroke-width="1.5">
      <title>${c.label}: ${c.latency}ms</title>
    </circle>
  `).join('') : '';

  return `
    <svg width="100%" viewBox="0 0 ${width} ${height}" class="report-chart" style="max-height: 240px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <defs>
        <linearGradient id="latencyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.01" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />

      <!-- Grid & Y Axis -->
      ${gridLines}

      <!-- Packet Loss Bars -->
      ${lossMarkers.join('')}

      <!-- Latency Area & Line -->
      ${areaD ? `<path d="${areaD}" fill="url(#latencyGrad)" />` : ''}
      ${pathD ? `<path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />` : ''}
      ${dots}

      <!-- Baseline -->
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${padding.left + chartW}" y2="${padding.top + chartH}" stroke="#cbd5e1" stroke-width="1.5" />

      <!-- X Axis Labels -->
      ${xLabels.join('')}

      <!-- Chart Legend in Corner -->
      <g transform="translate(${width - 230}, 14)">
        <rect x="0" y="0" width="215" height="20" rx="4" fill="#f8fafc" />
        <circle cx="12" cy="10" r="4" fill="#10b981" />
        <text x="22" y="14" font-size="11" fill="#334155" font-family="sans-serif">Latency (ms)</text>
        <rect x="105" y="6" width="8" height="8" fill="rgba(244, 63, 94, 0.6)" rx="1" />
        <text x="119" y="14" font-size="11" fill="#334155" font-family="sans-serif">Packet Loss / Down</text>
      </g>
    </svg>
  `;
}

/**
 * Report Service
 * Provides comprehensive telemetry analytics, PDF-printable executive HTML, and CSV exports.
 */
export class ReportService {
  /**
   * Generates comprehensive report analytics from dataStore
   */
  async getReportAnalytics(query = {}) {
    return dataStore.getReportAnalytics(query);
  }

  /**
   * Generates printable executive HTML report suitable for browser print-to-PDF
   */
  async generateMonitoringHtml(query = {}) {
    const analytics = await dataStore.getReportAnalytics(query);
    const { filter, metrics, incidents, timeSeries, deviceSummaries, branding, compliance, flappingDevices = [] } = analytics;

    const nowFormatted = new Date().toLocaleString();
    const fromFormatted = new Date(filter.from).toLocaleString();
    const toFormatted = new Date(filter.to).toLocaleString();

    const chartSvg = renderLatencySvgChart(timeSeries);

    // Color indicators for overall status
    let healthBadgeBg = '#dcfce7';
    let healthBadgeColor = '#15803d';
    let healthText = `OPTIMAL (Grade ${compliance?.healthGrade || 'A+'})`;
    if (metrics.uptimePercent < 90 || (compliance?.healthScore !== undefined && compliance.healthScore < 70)) {
      healthBadgeBg = '#ffe4e6';
      healthBadgeColor = '#b91c1c';
      healthText = `CRITICAL (Grade ${compliance?.healthGrade || 'F'})`;
    } else if (metrics.uptimePercent < 98 || (compliance?.healthScore !== undefined && compliance.healthScore < 90)) {
      healthBadgeBg = '#fef3c7';
      healthBadgeColor = '#b45309';
      healthText = `DEGRADED (Grade ${compliance?.healthGrade || 'B'})`;
    }

    const orgName = branding?.organizationName || 'NetPulse Enterprise';
    const reportSubtitle = branding?.reportSubtitle || 'Infrastructure SLA & Downtime Audit Report';
    const logoUrl = branding?.reportLogoUrl;
    const targetSla = compliance?.targetSlaPercent || 99.9;
    const isSlaMet = compliance?.slaStatus === 'SLA_MET';

    // Incidents Rows ("Kab Down hua, Kab UP hua, Downtime Duration, Reason")
    const incidentRows = incidents.length > 0 ? incidents.map((inc, idx) => {
      const downTime = new Date(inc.downAt).toLocaleString();
      const upTime = inc.upAt ? new Date(inc.upAt).toLocaleString() : 'Currently Active (Down)';
      const isOngoing = !inc.isResolved;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${isOngoing ? '#fff1f2' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc')};">
          <td style="padding: 10px 14px; font-weight: 600; color: #0f172a;">
            ${inc.deviceName}
            <div style="font-family: monospace; font-size: 11px; color: #64748b; font-weight: normal;">${inc.deviceIp}</div>
          </td>
          <td style="padding: 10px 14px; font-family: monospace; font-size: 12px; color: #b91c1c; font-weight: 600;">
            ${downTime}
          </td>
          <td style="padding: 10px 14px; font-family: monospace; font-size: 12px; color: ${isOngoing ? '#e11d48' : '#15803d'}; font-weight: ${isOngoing ? '700' : '500'};">
            ${upTime}
          </td>
          <td style="padding: 10px 14px; font-family: monospace; font-size: 12px; font-weight: 700; color: #334155;">
            ${inc.durationFormatted}
          </td>
          <td style="padding: 10px 14px; font-size: 12px; color: #475569; max-width: 300px; word-break: break-word;">
            ${inc.reason || 'Ping timeout / Destination Host Unreachable'}
          </td>
          <td style="padding: 10px 14px; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; background: ${isOngoing ? '#ffe4e6; color: #b91c1c;' : '#dcfce7; color: #15803d;'}">
              ${isOngoing ? 'ACTIVE OUTAGE' : 'RESOLVED'}
            </span>
          </td>
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="6" style="padding: 24px; text-align: center; color: #10b981; font-weight: 600; font-size: 13px;">
          ✓ 100% Stable: Zero Outage Incidents recorded for this time range!
        </td>
      </tr>
    `;

    // Device Summaries Table
    const deviceRows = deviceSummaries.map((d, idx) => {
      let stColor = '#10b981';
      let stBg = '#dcfce7';
      if (d.currentStatus === 'DOWN') { stColor = '#e11d48'; stBg = '#ffe4e6'; }
      else if (d.currentStatus === 'WARNING') { stColor = '#d97706'; stBg = '#fef3c7'; }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 9px 12px; font-weight: 600; color: #0f172a;">
            ${d.name}
            ${d.isFlapping ? '<span style="margin-left: 6px; padding: 2px 6px; background: #fef3c7; color: #b45309; border-radius: 4px; font-size: 10px; font-weight: 700;">FLAPPING</span>' : ''}
          </td>
          <td style="padding: 9px 12px; font-family: monospace; font-size: 12px; color: #475569;">${d.ip}</td>
          <td style="padding: 9px 12px; text-transform: capitalize; color: #64748b; font-size: 12px;">${d.type}</td>
          <td style="padding: 9px 12px; font-family: monospace; font-size: 12px; text-align: right;">${d.totalChecks}</td>
          <td style="padding: 9px 12px; font-weight: 700; color: ${d.uptimePercent >= 99 ? '#10b981' : d.uptimePercent >= 95 ? '#d97706' : '#e11d48'}; text-align: right;">
            ${d.uptimePercent}%
          </td>
          <td style="padding: 9px 12px; font-family: monospace; font-size: 12px; text-align: right; color: ${d.incidentsCount > 0 ? '#e11d48' : '#64748b'};">
            ${d.incidentsCount} (${d.totalDowntimeFormatted})
          </td>
          <td style="padding: 9px 12px; font-family: monospace; font-size: 12px; text-align: right;">
            ${d.avgLatency !== 'N/A' ? `${d.avgLatency}ms` : '—'}
          </td>
          <td style="padding: 9px 12px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; background: ${stBg}; color: ${stColor};">
              ${d.currentStatus}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>NetPulse Network Health & Incident Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    *, *:before, *:after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #f1f5f9;
      font-size: 13px;
      line-height: 1.5;
    }
    .report-card {
      background: #ffffff;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    h1, h2, h3, h4 { margin: 0; color: #0f172a; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-top: 16px;
    }
    .kpi-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
      font-family: -apple-system, BlinkMacSystemFont, monospace;
    }
    .kpi-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
    }
    th {
      background: #f8fafc;
      padding: 10px 14px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 11px;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .progress-bar-container {
      width: 100%;
      height: 12px;
      background: #e2e8f0;
      border-radius: 9999px;
      overflow: hidden;
      display: flex;
      margin-top: 8px;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #10b981;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: all 0.2s;
    }
    .btn-print:hover {
      background: #059669;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
        margin: 0;
        font-size: 11px;
      }
      .no-print {
        display: none !important;
      }
      .report-card {
        box-shadow: none;
        border: 1px solid #cbd5e1;
        padding: 16px;
        margin-bottom: 16px;
        page-break-inside: avoid;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>

  <!-- Top Action & Navigation Bar -->
  <div class="no-print" style="max-width: 1000px; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <span style="font-size: 12px; color: #64748b;">${orgName} Telemetry Suite</span>
      <h2 style="font-size: 18px; font-weight: 800; color: #0f172a;">${reportSubtitle}</h2>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" class="btn-print">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
        Print / Save to PDF
      </button>
    </div>
  </div>

  <div style="max-width: 1000px; margin: 0 auto;">

    <!-- Document Header with Organization White-Labeling -->
    <div class="report-card" style="border-top: 4px solid #10b981;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">
        <div style="display: flex; gap: 14px; align-items: center;">
          ${logoUrl ? `
            <img src="${logoUrl}" alt="${orgName}" style="max-height: 48px; max-width: 140px; object-fit: contain; border-radius: 8px;" />
          ` : `
            <div style="width: 44px; height: 44px; background: #10b981; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 20px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
              NP
            </div>
          `}
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px;">${orgName}</div>
            <h1 style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${reportSubtitle}</h1>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              Enterprise Infrastructure Availability & Root-Cause Failure Analysis
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; background: ${healthBadgeBg}; color: ${healthBadgeColor}; border: 1px solid currentColor;">
            HEALTH: ${healthText}
          </span>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Generated: <strong>${nowFormatted}</strong></div>
        </div>
      </div>

      <!-- Scope & Parameters Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; background: #f8fafc; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div>
          <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600;">Monitored Scope:</span>
          <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${filter.deviceName}</div>
          ${filter.deviceIp ? `<div style="font-family: monospace; color: #64748b; font-size: 11px;">${filter.deviceIp}</div>` : ''}
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600;">Date Range (From):</span>
          <div style="font-family: monospace; font-weight: 600; color: #0f172a; margin-top: 2px;">${fromFormatted}</div>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600;">Date Range (To):</span>
          <div style="font-family: monospace; font-weight: 600; color: #0f172a; margin-top: 2px;">${toFormatted}</div>
        </div>
        <div>
          <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600;">Period Duration:</span>
          <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${filter.isCustomRange ? `Custom Range (${filter.days} Days)` : `${filter.days} Days Window`}</div>
        </div>
      </div>

      <!-- Executive KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-box" style="border-left: 3px solid ${isSlaMet ? '#10b981' : '#e11d48'};">
          <div class="kpi-label">Uptime SLA</div>
          <div class="kpi-value" style="color: ${isSlaMet ? '#10b981' : '#e11d48'};">
            ${metrics.uptimePercent}%
          </div>
          <div style="font-size: 10px; font-weight: 700; color: ${isSlaMet ? '#15803d' : '#b91c1c'}; margin-top: 2px;">
            ${isSlaMet ? '✓ SLA MET' : '⚠ BREACHED'} (Target ${targetSla}%)
          </div>
        </div>

        <div class="kpi-box" style="border-left: 3px solid #6366f1;">
          <div class="kpi-label">Health Index</div>
          <div class="kpi-value" style="color: #6366f1;">
            ${compliance?.healthScore || 100}/100
          </div>
          <div style="font-size: 10px; font-weight: 700; color: #4f46e5; margin-top: 2px;">
            Grade: ${compliance?.healthGrade || 'A+'}
          </div>
        </div>

        <div class="kpi-box" style="border-left: 3px solid #e11d48;">
          <div class="kpi-label">Incidents</div>
          <div class="kpi-value" style="color: ${metrics.totalIncidents > 0 ? '#e11d48' : '#10b981'};">
            ${metrics.totalIncidents}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Outage Count</div>
        </div>

        <div class="kpi-box" style="border-left: 3px solid #f59e0b;">
          <div class="kpi-label">Total Outage Time</div>
          <div class="kpi-value" style="font-size: 16px; color: ${metrics.totalDowntimeSeconds > 0 ? '#d97706' : '#10b981'};">
            ${metrics.totalDowntimeFormatted}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Cumulative Outage</div>
        </div>

        <div class="kpi-box" style="border-left: 3px solid #3b82f6;">
          <div class="kpi-label">MTTR</div>
          <div class="kpi-value" style="font-size: 16px; color: #3b82f6;">
            ${metrics.mttrFormatted}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Avg Incident MTTR</div>
        </div>

        <div class="kpi-box" style="border-left: 3px solid #8b5cf6;">
          <div class="kpi-label">Avg Latency</div>
          <div class="kpi-value" style="color: #6366f1;">
            ${metrics.avgLatency !== null ? `${metrics.avgLatency}ms` : '—'}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Loss: ${metrics.avgPacketLoss}%</div>
        </div>
      </div>

      ${flappingDevices.length > 0 ? `
      <!-- Flapping Host Warning Strip -->
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 12px 16px; margin-top: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #b45309; font-size: 13px;">
          ⚠️ Flapping Hosts Alert (${flappingDevices.length} Unstable Links Detected)
        </div>
        <div style="font-size: 12px; color: #78350f; margin-top: 4px;">
          The following monitored hosts experienced >= 3 outage cycles in this time window: 
          <strong>${flappingDevices.map(d => `${d.name} (${d.ip}) [${d.incidentsCount} events]`).join(', ')}</strong>.
        </div>
      </div>
      ` : ''}

      <!-- Availability Breakdown Strip -->
      <div style="margin-top: 18px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 600;">
          <span style="color: #10b981;">UP: ${metrics.pureUptimePercent}% (${metrics.upChecks} probes)</span>
          <span style="color: #d97706;">WARNING: ${metrics.warningPercent}% (${metrics.warningChecks} probes)</span>
          <span style="color: #e11d48;">DOWN: ${metrics.downtimePercent}% (${metrics.downChecks} probes)</span>
        </div>
        <div class="progress-bar-container">
          <div style="width: ${metrics.pureUptimePercent}%; background: #10b981;" title="UP: ${metrics.pureUptimePercent}%"></div>
          <div style="width: ${metrics.warningPercent}%; background: #f59e0b;" title="WARNING: ${metrics.warningPercent}%"></div>
          <div style="width: ${metrics.downtimePercent}%; background: #e11d48;" title="DOWN: ${metrics.downtimePercent}%"></div>
        </div>
      </div>
    </div>

    <!-- Section 1: Visual Telemetry Graph -->
    <div class="report-card">
      <div class="section-title">
        <svg width="18" height="18" fill="none" stroke="#10b981" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Historical Latency & Outage Timeline (Telemetry Probing)
      </div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
        Continuous round-trip ping time (ms) and packet loss events mapped chronologically over the selected duration.
      </div>
      <div>
        ${chartSvg}
      </div>
    </div>

    <!-- Section 2: Outage & Incident Log ("Up and Down time kab aya or q sahi") -->
    <div class="report-card">
      <div class="section-title" style="justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" fill="none" stroke="#e11d48" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Outage & Downtime Incident Log (Root-Cause Failure Audit)
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #64748b;">
          ${incidents.length} Incident${incidents.length === 1 ? '' : 's'} Recorded
        </span>
      </div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 14px;">
        Exact timestamps when device went DOWN, when recovery occurred, duration of outage, and error message/reason.
      </div>

      <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
        <table>
          <thead>
            <tr>
              <th>Device & Host</th>
              <th>Went DOWN (Timestamp)</th>
              <th>Recovered UP (Timestamp)</th>
              <th>Outage Duration</th>
              <th>Failure Cause / Reason</th>
              <th style="text-align: center;">Incident Status</th>
            </tr>
          </thead>
          <tbody>
            ${incidentRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 3: Device Inventory Matrix (Summary per device) -->
    <div class="report-card">
      <div class="section-title">
        <svg width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        Monitored Devices Inventory & Performance Matrix
      </div>

      <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
        <table>
          <thead>
            <tr>
              <th>Device Name</th>
              <th>IP Address</th>
              <th>Type</th>
              <th style="text-align: right;">Probes</th>
              <th style="text-align: right;">Uptime %</th>
              <th style="text-align: right;">Outages (Total Time)</th>
              <th style="text-align: right;">Avg Latency</th>
              <th style="text-align: center;">Current Status</th>
            </tr>
          </thead>
          <tbody>
            ${deviceRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #94a3b8; font-size: 11px; padding: 12px; border-top: 1px solid #e2e8f0; margin-top: 16px;">
      NetPulse Network Monitoring System • Automated Health & Diagnostics Report • Generated by Python 3.12 Monitor Engine & Express DataStore
    </div>

  </div>

</body>
</html>`;
  }

  /**
   * Generates CSV string with incident log and devices
   */
  async generateMonitoringCsv(query = {}) {
    const analytics = await dataStore.getReportAnalytics(query);
    const { filter, metrics, incidents, deviceSummaries, branding, compliance, flappingDevices = [] } = analytics;

    const lines = [];

    // Header Metadata with Organization White-labeling
    const org = branding?.organizationName || 'NetPulse Enterprise';
    const sub = branding?.reportSubtitle || 'Network Health & Incident Report';
    lines.push(`"${org} — ${sub}"`);
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push(`Scope,${filter.deviceName}`);
    lines.push(`From,${filter.from}`);
    lines.push(`To,${filter.to}`);
    lines.push(`Target SLA %,${compliance?.targetSlaPercent || 99.9}%`);
    lines.push(`Actual Uptime %,${metrics.uptimePercent}%`);
    lines.push(`SLA Status,${compliance?.slaStatus || 'SLA_MET'}`);
    lines.push(`Fleet Health Index,${compliance?.healthScore || 100}/100 (Grade ${compliance?.healthGrade || 'A+'})`);
    lines.push(`Unstable/Flapping Hosts Count,${flappingDevices.length}`);
    lines.push(`Total Downtime Incidents,${metrics.totalIncidents}`);
    lines.push(`Total Downtime Duration,${metrics.totalDowntimeFormatted}`);
    lines.push(`Avg Latency,${metrics.avgLatency !== null ? `${metrics.avgLatency}ms` : 'N/A'}`);
    lines.push(``);

    // Section 1: Outage Incidents Table
    lines.push(`--- OUTAGE & INCIDENT LOG ---`);
    lines.push([`Device Name`, `IP Address`, `Went Down At`, `Recovered At`, `Duration`, `Cause / Failure Reason`, `Status`].join(','));
    for (const inc of incidents) {
      lines.push([
        `"${(inc.deviceName || '').replace(/"/g, '""')}"`,
        `"${(inc.deviceIp || '').replace(/"/g, '""')}"`,
        `"${inc.downAt}"`,
        `"${inc.upAt || 'Currently Active'}"`,
        `"${inc.durationFormatted}"`,
        `"${(inc.reason || '').replace(/"/g, '""')}"`,
        `"${inc.isResolved ? 'RESOLVED' : 'ACTIVE_OUTAGE'}"`
      ].join(','));
    }
    lines.push(``);

    // Section 2: Devices Performance Matrix
    lines.push(`--- DEVICE PERFORMANCE MATRIX ---`);
    lines.push([`Device Name`, `IP Address`, `Type`, `Total Probes`, `Uptime %`, `Outage Count`, `Total Downtime`, `Avg Latency (ms)`, `Current Status`].join(','));
    for (const d of deviceSummaries) {
      lines.push([
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.ip || '').replace(/"/g, '""')}"`,
        `"${d.type}"`,
        d.totalChecks,
        `${d.uptimePercent}%`,
        d.incidentsCount,
        `"${d.totalDowntimeFormatted}"`,
        d.avgLatency !== 'N/A' ? d.avgLatency : '',
        `"${d.currentStatus}"`
      ].join(','));
    }

    return lines.join('\r\n');
  }
}

export const reportService = new ReportService();
export default reportService;
