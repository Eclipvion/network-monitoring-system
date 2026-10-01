import dataStore from './dataStore.js';

/**
 * Report Service
 * Reads data exclusively through dataStore.js and formats exports.
 */
export class ReportService {
  /**
   * Generates CSV string for monitoring export
   */
  async generateMonitoringCsv(query = {}) {
    const { type, status, from, to } = query;
    const rows = await dataStore.getMonitoringExportData({ type, status, from, to });

    const headers = ['Device Name', 'IP Address', 'Type', 'Status', 'Latency (ms)', 'Packet Loss (%)', 'Last Checked'];
    const lines = [headers.join(',')];

    for (const r of rows) {
      const sanitizedName = `"${(r.name || '').replace(/"/g, '""')}"`;
      const sanitizedIp = `"${(r.ip || '').replace(/"/g, '""')}"`;
      const sanitizedType = `"${(r.type || '').replace(/"/g, '""')}"`;
      const sanitizedStatus = `"${(r.status || '').replace(/"/g, '""')}"`;
      const latency = r.latency !== undefined ? r.latency : 'N/A';
      const packetLoss = r.packetLoss !== undefined ? `${r.packetLoss}%` : '0%';
      const lastChecked = r.lastChecked ? `"${new Date(r.lastChecked).toLocaleString()}"` : '"Never"';

      lines.push([sanitizedName, sanitizedIp, sanitizedType, sanitizedStatus, latency, packetLoss, lastChecked].join(','));
    }

    return lines.join('\r\n');
  }

  /**
   * Generates printable HTML suitable for browser print-to-PDF
   */
  async generateMonitoringHtml(query = {}) {
    const { type, status, from, to } = query;
    const rows = await dataStore.getMonitoringExportData({ type, status, from, to });
    const now = new Date().toLocaleString();

    const tableRows = rows.map(r => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 14px; font-weight: 600;">${r.name}</td>
        <td style="padding: 10px 14px; font-family: monospace;">${r.ip}</td>
        <td style="padding: 10px 14px; text-transform: capitalize;">${r.type}</td>
        <td style="padding: 10px 14px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; background: ${
            r.status === 'UP' ? '#dcfce7; color: #15803d;' : r.status === 'DOWN' ? '#ffe4e6; color: #b91c1c;' : '#fef3c7; color: #b45309;'
          }">
            ${r.status}
          </span>
        </td>
        <td style="padding: 10px 14px; font-family: monospace;">${r.latency !== 'N/A' ? `${r.latency} ms` : '—'}</td>
        <td style="padding: 10px 14px; font-family: monospace;">${r.packetLoss}%</td>
        <td style="padding: 10px 14px; font-size: 12px; color: #64748b;">${r.lastChecked !== 'Never' ? new Date(r.lastChecked).toLocaleString() : 'Never'}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NetPulse Network Health Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; }
    h1 { margin-bottom: 4px; color: #0f172a; font-size: 24px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { background: #f8fafc; padding: 12px 14px; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569; }
    @media print {
      body { margin: 15mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
    <div>
      <h1>NetPulse — Network Health & Telemetry Report</h1>
      <div class="meta">Generated: ${now} | Total Monitored Endpoints: ${rows.length}</div>
    </div>
    <div class="no-print">
      <button onclick="window.print()" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Device Name</th>
        <th>IP Address</th>
        <th>Type</th>
        <th>Status</th>
        <th>Latency</th>
        <th>Packet Loss</th>
        <th>Last Checked</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;
  }
}

export const reportService = new ReportService();
export default reportService;
