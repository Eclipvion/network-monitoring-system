import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import reportService from './reportService.js';
import dataStore from './dataStore.js';
import * as securityService from './securityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const EMAIL_CONFIG_FILE = path.join(DATA_DIR, 'email_report_config.json');

const DEFAULT_CONFIG = {
  enabled: true,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  senderName: 'NetPulse Enterprise NOC & SOC',
  senderEmail: '',
  recipients: '',
  recipientList: [], // [{ id, email, label, enabled }]
  frequency: 'daily', // 'daily' | 'weekly'
  scheduledHour: 9,   // 9 AM
  daysToCover: 1,     // 1 day for daily, 7 for weekly
  // Real-time Auto-Send Triggers (Active by Default)
  autoSendOutageAlerts: true,
  autoSendSecurityAlerts: true,
  autoSendCriticalSearchAlerts: true,
  lastSentAt: null,
  lastStatus: null,
  lastError: null,
  dispatchHistory: []
};

function getPrimaryLanUrl() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return `http://${net.address}:5173`;
        }
      }
    }
  } catch (_) {}
  return 'http://172.18.1.11:5173';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Universal Outlook / M365 / Gmail Safe Executive Email Wrapper
 * Uses 100% table-based layout with explicit bgcolor attributes so dark headers
 * never render as white-on-white in Microsoft Outlook or corporate mail gateways.
 */
function buildCorporateEmailLayout({
  categoryLabel = 'NETPULSE ENTERPRISE NOC & SOC',
  title = 'Executive Infrastructure Audit Report',
  subtitle = '',
  statusBadgeText = 'OPTIMAL',
  statusBadgeBg = '#10b981',
  accentColor = '#0ea5e9',
  greeting = 'Dear IT Leadership, NOC & SOC Operations Team,',
  introParagraph = '',
  kpiCards = [], // [{ label, value, subtext, color }]
  suggestionsTitle = 'Strategic NOC / SOC Recommendations & Action Plan',
  suggestions = [], // [{ priority: 'CRITICAL'|'HIGH'|'RECOMMENDED'|'OPTIMAL', title, detail }]
  sectionsHtml = '',
  autoScheduleSummary = 'Automated Real-Time Event Alerts & Scheduled Reports are ACTIVE for your recipient group.'
}) {
  const reportId = `NP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const generatedAt = new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const dashboardUrl = getPrimaryLanUrl();

  // Render 4 KPI Cards in a 100% Outlook-safe table row
  const kpiCellsHtml = kpiCards
    .map((card) => {
      const valColor = card.color || '#0f172a';
      return `
        <td width="${Math.floor(100 / Math.max(1, kpiCards.length))}%" valign="top" style="padding: 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid ${valColor}; border-radius: 8px;">
            <tr>
              <td style="padding: 14px 12px; text-align: center;">
                <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">
                  ${escapeHtml(card.label)}
                </div>
                <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 24px; font-weight: 800; color: ${valColor}; margin: 6px 0 4px 0;">
                  ${escapeHtml(card.value)}
                </div>
                <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #475569;">
                  ${escapeHtml(card.subtext || '')}
                </div>
              </td>
            </tr>
          </table>
        </td>
      `;
    })
    .join('');

  // Render Smart Recommendations & Suggestions Box
  const suggestionItemsHtml = suggestions
    .map((s) => {
      let badgeBg = '#e0f2fe';
      let badgeTextCol = '#0369a1';
      let borderLeftCol = '#0284c7';
      if (s.priority === 'CRITICAL') {
        badgeBg = '#ffe4e6';
        badgeTextCol = '#be123c';
        borderLeftCol = '#e11d48';
      } else if (s.priority === 'HIGH' || s.priority === 'ACTION REQUIRED') {
        badgeBg = '#fef3c7';
        badgeTextCol = '#b45309';
        borderLeftCol = '#f59e0b';
      } else if (s.priority === 'OPTIMAL' || s.priority === 'GOOD') {
        badgeBg = '#dcfce7';
        badgeTextCol = '#15803d';
        borderLeftCol = '#10b981';
      }

      return `
        <tr>
          <td style="padding: 6px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${borderLeftCol}; border-radius: 6px;">
              <tr>
                <td style="padding: 12px 14px;">
                  <div style="margin-bottom: 4px;">
                    <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeTextCol}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 6px;">
                      ${escapeHtml(s.priority || 'RECOMMENDATION')}
                    </span>
                    <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #0f172a;">
                      ${escapeHtml(s.title)}
                    </strong>
                  </div>
                  <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #334155; line-height: 1.55;">
                    ${s.detail}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!-- MAIN 760PX EMAIL CONTAINER -->
        <table width="760" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width: 760px; width: 100%; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
          
          <!-- TOP ACCENT STRIPE -->
          <tr>
            <td bgcolor="${accentColor}" style="background-color: ${accentColor}; height: 6px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- CORPORATE DARK HEADER BANNER (SOLID BGCOLOR FOR OUTLOOK/M365) -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 26px 30px; color: #ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top">
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.4px; margin-bottom: 6px;">
                      ${escapeHtml(categoryLabel)}
                    </div>
                    <h1 style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 6px 0; line-height: 1.25;">
                      ${escapeHtml(title)}
                    </h1>
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #cbd5e1;">
                      ${escapeHtml(subtitle)}
                    </div>
                  </td>
                  <td valign="top" align="right" style="white-space: nowrap; padding-left: 16px;">
                    <span style="display: inline-block; background-color: ${statusBadgeBg}; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 999px; letter-spacing: 0.6px; text-transform: uppercase;">
                      ${escapeHtml(statusBadgeText)}
                    </span>
                    <div style="font-family: Consolas, monospace; font-size: 11px; color: #94a3b8; margin-top: 10px;">
                      Ref: ${reportId}<br/>
                      ${escapeHtml(generatedAt)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY CONTENT AREA -->
          <tr>
            <td style="padding: 26px 30px;">
              
              <!-- EXECUTIVE GREETING & BRIEFING LETTER -->
              <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
                ${escapeHtml(greeting)}
              </div>
              <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #334155; line-height: 1.65; margin-bottom: 20px;">
                ${introParagraph}
              </div>

              <!-- 4 EXECUTIVE KPI CARDS -->
              ${
                kpiCards.length > 0
                  ? `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 22px;">
                  <tr>
                    ${kpiCellsHtml}
                  </tr>
                </table>
              `
                  : ''
              }

              <!-- ACTIONABLE NOC / SOC SUGGESTIONS & RECOMMENDATIONS -->
              ${
                suggestions.length > 0
                  ? `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 24px; overflow: hidden;">
                  <tr>
                    <td bgcolor="#1e293b" style="background-color: #1e293b; padding: 11px 16px; color: #ffffff;">
                      <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.8px;">
                        💡 ${escapeHtml(suggestionsTitle)}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 16px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${suggestionItemsHtml}
                      </table>
                    </td>
                  </tr>
                </table>
              `
                  : ''
              }

              <!-- DETAILED DATA TABLES / SECTIONS -->
              ${sectionsHtml}

              <!-- CALL TO ACTION BUTTON & SIGN-OFF -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 26px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td valign="middle">
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #334155; line-height: 1.6;">
                      Best regards,<br/>
                      <strong style="color: #0f172a;">NetPulse Enterprise NOC &amp; Cyber SOC Engine</strong><br/>
                      <span style="font-size: 11px; color: #64748b;">Automated Infrastructure Monitoring, Port Auditing &amp; Endpoint Telemetry</span>
                    </div>
                  </td>
                  <td valign="middle" align="right">
                    <a href="${dashboardUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #334155;">
                      Open Live NOC Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- CORPORATE FOOTER WITH AUTO-DISPATCH CONFIRMATION -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #475569; line-height: 1.5;">
                    <strong style="color: #059669;">● Auto-Email Dispatch Active:</strong> ${escapeHtml(autoScheduleSummary)}<br/>
                    <span style="color: #94a3b8;">CONFIDENTIAL — This automated report contains privileged network &amp; security telemetry intended solely for authorized IT/SOC personnel.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

class EmailReportService {
  constructor() {
    this.initStorage();
    this.config = this.loadConfig();
    this.cooldownMap = new Map(); // Anti-spam cooldown tracker
    this.schedulerTimer = null;
    this.startScheduler();
  }

  initStorage() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(EMAIL_CONFIG_FILE)) {
      fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
  }

  normalizeRecipientList(cfg) {
    let list = Array.isArray(cfg.recipientList) ? [...cfg.recipientList] : [];
    if (list.length === 0 && cfg.recipients && typeof cfg.recipients === 'string') {
      const parts = cfg.recipients
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));
      list = parts.map((email, idx) => ({
        id: `rec-${Date.now()}-${idx}`,
        email,
        label: idx === 0 ? 'Primary Admin' : 'NOC Recipient',
        enabled: true
      }));
    }
    const activeEmails = list
      .filter((r) => r && r.enabled !== false && r.email && r.email.includes('@'))
      .map((r) => r.email.trim());

    return {
      recipientList: list,
      recipients: activeEmails.join(', ')
    };
  }

  loadConfig() {
    try {
      const data = fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8');
      const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      const norm = this.normalizeRecipientList(parsed);
      return {
        ...parsed,
        enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
        autoSendOutageAlerts: parsed.autoSendOutageAlerts !== undefined ? Boolean(parsed.autoSendOutageAlerts) : true,
        autoSendSecurityAlerts: parsed.autoSendSecurityAlerts !== undefined ? Boolean(parsed.autoSendSecurityAlerts) : true,
        autoSendCriticalSearchAlerts: parsed.autoSendCriticalSearchAlerts !== undefined ? Boolean(parsed.autoSendCriticalSearchAlerts) : true,
        recipientList: norm.recipientList,
        recipients: norm.recipients,
        dispatchHistory: Array.isArray(parsed.dispatchHistory) ? parsed.dispatchHistory.slice(0, 25) : []
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig(newConfig = {}) {
    const incomingPass =
      newConfig.smtpPass && newConfig.smtpPass !== '••••••••'
        ? newConfig.smtpPass
        : this.config.smtpPass;

    const merged = {
      ...this.config,
      ...newConfig,
      smtpPass: incomingPass
    };

    if (
      typeof newConfig.recipients === 'string' &&
      !Array.isArray(newConfig.recipientList)
    ) {
      const existingMap = new Map(
        (this.config.recipientList || []).map((r) => [r.email.toLowerCase(), r])
      );
      const emails = newConfig.recipients
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));

      merged.recipientList = emails.map((email, idx) => {
        const prev = existingMap.get(email.toLowerCase());
        return prev || {
          id: `rec-${Date.now()}-${idx}`,
          email,
          label: 'NOC Recipient',
          enabled: true
        };
      });
    }

    const norm = this.normalizeRecipientList(merged);
    merged.recipientList = norm.recipientList;
    merged.recipients = norm.recipients;

    this.config = merged;
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(this.config, null, 2));
    return this.getPublicConfig();
  }

  getPublicConfig() {
    const safe = { ...this.config };
    if (safe.smtpPass) {
      safe.hasPassword = true;
      safe.smtpPass = '••••••••';
    } else {
      safe.hasPassword = false;
    }
    return safe;
  }

  getActiveRecipients(overrideRecipients = null) {
    if (overrideRecipients && typeof overrideRecipients === 'string' && overrideRecipients.trim()) {
      return overrideRecipients.trim();
    }
    const activeFromList = (this.config.recipientList || [])
      .filter((r) => r && r.enabled !== false && r.email && r.email.includes('@'))
      .map((r) => r.email.trim());

    if (activeFromList.length > 0) {
      return activeFromList.join(', ');
    }
    return (this.config.recipients || '').trim();
  }

  isSmtpConfigured() {
    return Boolean(
      this.config.smtpHost &&
      this.config.smtpUser &&
      this.config.smtpPass &&
      this.getActiveRecipients()
    );
  }

  createTransporter(overrideConfig = null) {
    const c = overrideConfig ? { ...this.config, ...overrideConfig } : this.config;
    const rawPass =
      overrideConfig && overrideConfig.smtpPass && overrideConfig.smtpPass !== '••••••••'
        ? overrideConfig.smtpPass
        : this.config.smtpPass;

    const host = String(c.smtpHost || 'smtp.gmail.com').trim();
    const pass = host.toLowerCase().includes('gmail')
      ? String(rawPass || '').replace(/\s+/g, '')
      : String(rawPass || '').trim();
    const user = String(c.smtpUser || '').trim();
    const port = Number(c.smtpPort) || 587;
    const isSecure = port === 465 ? true : Boolean(c.smtpSecure);

    return nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      requireTLS: port === 587,
      auth: {
        user,
        pass
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      }
    });
  }

  recordDispatchLog({ type, subject, recipients, status, error = null }) {
    const now = new Date().toISOString();
    this.config.lastSentAt = now;
    this.config.lastStatus = status;
    this.config.lastError = error;

    const entry = {
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      type,
      subject,
      recipients,
      status,
      error
    };

    const history = Array.isArray(this.config.dispatchHistory) ? this.config.dispatchHistory : [];
    this.config.dispatchHistory = [entry, ...history].slice(0, 25);
    try {
      fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (_) {}
  }

  async dispatchMail({ type, subject, html, text, recipients = null, configOverride = null }) {
    if (configOverride && typeof configOverride === 'object') {
      this.saveConfig(configOverride);
    }

    const targetRecipients = this.getActiveRecipients(recipients);
    if (!targetRecipients) {
      throw new Error('No active recipient email addresses configured. Add at least one email in Settings -> Email & Recipients.');
    }
    if (!this.config.smtpUser || !this.config.smtpPass) {
      throw new Error('SMTP Username and App Password are not configured yet. Please configure them in Settings -> Email & Recipients.');
    }

    const transporter = this.createTransporter();
    const senderAddr = this.config.smtpUser.trim();
    const fromAddress = `"${this.config.senderName || 'NetPulse Enterprise NOC & SOC'}" <${senderAddr}>`;

    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: targetRecipients,
        subject,
        html,
        text
      });

      this.recordDispatchLog({
        type,
        subject,
        recipients: targetRecipients,
        status: 'SUCCESS',
        error: null
      });

      return {
        success: true,
        messageId: info.messageId,
        sentTo: targetRecipients,
        sentAt: this.config.lastSentAt
      };
    } catch (err) {
      this.recordDispatchLog({
        type,
        subject,
        recipients: targetRecipients,
        status: 'ERROR',
        error: err.message
      });
      throw err;
    }
  }

  async testConnection(testCfg = null) {
    try {
      const merged = testCfg ? { ...this.config, ...testCfg } : this.config;
      const effectivePass =
        testCfg && testCfg.smtpPass && testCfg.smtpPass !== '••••••••'
          ? testCfg.smtpPass
          : this.config.smtpPass;

      if (!merged.smtpHost || !merged.smtpUser || !effectivePass) {
        return {
          success: false,
          message: 'Please enter SMTP Host, Username (Email), and Password / App Password first.'
        };
      }

      this.saveConfig({
        ...merged,
        smtpPass: effectivePass
      });

      const transporter = this.createTransporter({ ...merged, smtpPass: effectivePass });
      await transporter.verify();
      return { success: true, message: 'SMTP connection verified & saved successfully!' };
    } catch (err) {
      return { success: false, message: `SMTP verification failed: ${err.message}` };
    }
  }

  // =========================================================================
  // 1. SLA & UPTIME EXECUTIVE REPORT EMAIL (WITH SMART SUGGESTIONS)
  // =========================================================================
  async sendReportNow({ recipients = null, days = null, isTest = false, configOverride = null } = {}) {
    const daysCount = days || (this.config.frequency === 'weekly' ? 7 : 1);
    const analytics = await reportService.getReportAnalytics({ days: daysCount });
    const { metrics, incidents = [], deviceSummaries = [], branding = {}, compliance = {}, flappingDevices = [] } = analytics;

    const orgName = branding.organizationName || 'NetPulse Enterprise NOC';
    const isSlaMet = compliance.slaStatus === 'SLA_MET';
    const downDevices = deviceSummaries.filter((d) => d.currentStatus === 'DOWN');
    const highLatDevices = deviceSummaries.filter((d) => Number(d.avgLatency) > 100);

    // Build Dynamic Smart Suggestions for SLA & Uptime
    const suggestions = [];
    if (downDevices.length > 0) {
      suggestions.push({
        priority: 'CRITICAL',
        title: `Immediate Outage Investigation Required (${downDevices.length} Host${downDevices.length > 1 ? 's' : ''} Offline)`,
        detail: `The following monitored endpoint(s) are currently unreachable: <strong>${downDevices.map((d) => `${escapeHtml(d.name)} (${escapeHtml(d.ip)})`).join(', ')}</strong>. Verify physical Ethernet link/power state, inspect VLAN switch port status, and confirm local firewall ICMP Echo rules.`
      });
    }
    if (flappingDevices.length > 0) {
      suggestions.push({
        priority: 'HIGH',
        title: `Network Link Flapping Detected on ${flappingDevices.length} Endpoint(s)`,
        detail: `Intermittent UP/DOWN state transitions detected on <strong>${flappingDevices.map((d) => escapeHtml(d.name)).join(', ')}</strong>. Recommend replacing patch cables, checking Wi-Fi AP signal congestion, or increasing retry thresholds in Settings.`
      });
    }
    if (highLatDevices.length > 0 || Number(metrics.avgLatency) > 85) {
      suggestions.push({
        priority: 'HIGH',
        title: 'WAN / LAN Latency & QoS Traffic Shaping Optimization',
        detail: `Average network latency is <strong>${metrics.avgLatency}ms</strong> (Jitter: <strong>${metrics.jitterMs || 0}ms</strong>). Configure router Quality of Service (QoS) queues to prioritize business-critical traffic and inspect bandwidth-heavy endpoints.`
      });
    }
    if (!isSlaMet) {
      suggestions.push({
        priority: 'ACTION REQUIRED',
        title: `SLA Target Breach (${metrics.uptimePercent}% vs ${compliance.targetSlaPercent || 99.9}% Target)`,
        detail: `Total downtime of <strong>${metrics.totalDowntimeFormatted}</strong> exceeded the SLA budget. Consider configuring secondary ISP WAN failover and redundant power (UPS) for core routing equipment.`
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'OPTIMAL',
        title: 'Infrastructure Operating at Peak SLA Efficiency',
        detail: `All <strong>${deviceSummaries.length}</strong> monitored endpoints achieved <strong>${metrics.uptimePercent}%</strong> uptime with an average latency of <strong>${metrics.avgLatency}ms</strong>. Continue automated daily telemetry polling and weekly firewall port audits.`
      });
    }
    suggestions.push({
      priority: 'RECOMMENDED',
      title: 'Proactive Capacity & Redundancy Best Practice',
      detail: 'Maintain automated daily SLA email digests for management visibility and review the Security Hub weekly to ensure zero unauthorized ports are exposed on LAN hosts.'
    });

    // Build Device Table
    const deviceRowsHtml = deviceSummaries
      .slice(0, 30)
      .map((d, idx) => {
        const isDown = d.currentStatus === 'DOWN';
        const isWarn = d.currentStatus === 'WARNING';
        const badgeBg = isDown ? '#ffe4e6' : isWarn ? '#fef3c7' : '#dcfce7';
        const badgeCol = isDown ? '#be123c' : isWarn ? '#b45309' : '#15803d';
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #0f172a;">
              ${escapeHtml(d.name)}
            </td>
            <td style="padding: 10px 12px; font-family: Consolas, monospace; font-size: 12px; color: #0284c7;">
              ${escapeHtml(d.ip)}
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #475569; text-transform: capitalize;">
              ${escapeHtml(d.type || 'Host')}
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: ${d.uptimePercent >= 99 ? '#059669' : '#d97706'};">
              ${d.uptimePercent}%
            </td>
            <td style="padding: 10px 12px; font-family: Consolas, monospace; font-size: 12px; color: #334155;">
              ${d.avgLatency !== 'N/A' ? `${d.avgLatency}ms` : '—'}
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #64748b;">
              ${d.incidentsCount} (${escapeHtml(d.totalDowntimeFormatted)})
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeCol}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 999px;">
                ${escapeHtml(d.currentStatus)}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    // Build Outage Incidents Table
    const incidentRowsHtml = incidents
      .slice(0, 15)
      .map((inc, idx) => {
        const isOngoing = !inc.isResolved;
        const rowBg = isOngoing ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #0f172a;">
              ${escapeHtml(inc.deviceName)} <span style="font-family: Consolas, monospace; font-size: 11px; color: #64748b;">(${escapeHtml(inc.deviceIp)})</span>
            </td>
            <td style="padding: 9px 12px; font-family: Consolas, monospace; font-size: 11px; color: #be123c;">
              ${new Date(inc.downAt).toLocaleString()}
            </td>
            <td style="padding: 9px 12px; font-family: Consolas, monospace; font-size: 11px; color: ${isOngoing ? '#e11d48' : '#15803d'}; font-weight: 700;">
              ${inc.upAt ? new Date(inc.upAt).toLocaleString() : 'ACTIVE OUTAGE'}
            </td>
            <td style="padding: 9px 12px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #334155;">
              ${escapeHtml(inc.durationFormatted)}
            </td>
            <td style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #475569;">
              ${escapeHtml(inc.reason || 'ICMP Echo Timeout')}
            </td>
          </tr>
        `;
      })
      .join('');

    const sectionsHtml = `
      <!-- DEVICE SLA PERFORMANCE TABLE -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 22px;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 12px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.7px;">
              📊 Monitored Endpoint Availability &amp; Latency Scorecard
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Endpoint Name</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">IP Address</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Type</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Uptime</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Avg Ping</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Outages</th>
                  <th align="center" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${deviceRowsHtml || '<tr><td colspan="7" style="padding: 18px; text-align: center; color: #64748b;">No monitored endpoints found.</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <!-- DOWNTIME INCIDENT CHRONOLOGY -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#1e293b" style="background-color: #1e293b; padding: 12px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.7px;">
              ⏱️ Recent Outage &amp; Recovery Incident Chronology
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Device</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Down Time</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Recovery Time</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Duration</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Root Cause / Diagnostic</th>
                </tr>
              </thead>
              <tbody>
                ${incidentRowsHtml || '<tr><td colspan="5" style="padding: 18px; text-align: center; color: #059669; font-weight: 700; font-size: 12px;">✓ Zero Outage Incidents recorded during this audit window.</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>
      </table>
    `;

    const htmlContent = buildCorporateEmailLayout({
      categoryLabel: `${orgName} • EXECUTIVE SLA & UPTIME AUDIT`,
      title: `Network Infrastructure Health & SLA Report (${daysCount}-Day Window)`,
      subtitle: `Automated Availability, Latency, MTTR & Incident Compliance Briefing`,
      statusBadgeText: isSlaMet ? `SLA MET (${compliance.healthGrade || 'A+'})` : `SLA AT RISK (${compliance.healthGrade || 'C'})`,
      statusBadgeBg: isSlaMet ? '#10b981' : '#e11d48',
      accentColor: isSlaMet ? '#10b981' : '#e11d48',
      introParagraph: `Please find enclosed the official <strong>${daysCount}-Day Network Availability &amp; SLA Compliance Report</strong> generated by <strong>${escapeHtml(orgName)}</strong>. During this evaluation period, your infrastructure recorded an overall uptime of <strong>${metrics.uptimePercent}%</strong> (Health Score: <strong>${compliance.healthScore || 100}/100</strong>) across <strong>${deviceSummaries.length} monitored endpoints</strong>, with <strong>${metrics.totalIncidents} outage incident(s)</strong> and an average round-trip latency of <strong>${metrics.avgLatency}ms</strong>. Review our automated engineering recommendations below for actionable next steps.`,
      kpiCards: [
        {
          label: 'Overall Network Uptime',
          value: `${metrics.uptimePercent}%`,
          subtext: `Target SLA: ${compliance.targetSlaPercent || 99.9}%`,
          color: isSlaMet ? '#059669' : '#e11d48'
        },
        {
          label: 'Health Score & Grade',
          value: `${compliance.healthScore || 100}/100`,
          subtext: `Executive Grade: ${compliance.healthGrade || 'A+'}`,
          color: '#0284c7'
        },
        {
          label: 'Outage Incidents',
          value: `${metrics.totalIncidents}`,
          subtext: `Downtime: ${metrics.totalDowntimeFormatted}`,
          color: metrics.totalIncidents > 0 ? '#e11d48' : '#059669'
        },
        {
          label: 'Avg Ping / MTTR',
          value: `${metrics.avgLatency}ms`,
          subtext: `MTTR: ${compliance.mttrFormatted || '0s'}`,
          color: '#7c3aed'
        }
      ],
      suggestionsTitle: 'Engineering Recommendations & SLA Optimization Plan',
      suggestions,
      sectionsHtml
    });

    const subject = isTest
      ? `[Executive Briefing] ${orgName} — Network Health & SLA Report (${daysCount}d)`
      : `[${orgName}] Executive Network Health & SLA Report (Uptime: ${metrics.uptimePercent}%) - ${new Date().toLocaleDateString()}`;

    const text = `NetPulse Network Audit: Uptime ${metrics.uptimePercent}% | SLA: ${compliance.slaStatus} | Score: ${compliance.healthScore}/100.`;

    return this.dispatchMail({
      type: 'SLA_REPORT',
      subject,
      html: htmlContent,
      text,
      recipients,
      configOverride
    });
  }

  // =========================================================================
  // 2. NETWORK ALERTS & OUTAGES SUMMARY REPORT EMAIL (WITH SMART SUGGESTIONS)
  // =========================================================================
  async sendAlertsReportNow({ recipients = null } = {}) {
    const alerts = await dataStore.getAlerts();
    const devices = await dataStore.getDevices();
    const activeAlerts = alerts.filter((a) => !a.resolved);
    const resolvedAlerts = alerts.filter((a) => a.resolved);
    const downDevices = devices.filter((d) => d.status === 'DOWN');

    // Dynamic Suggestions for Network Alerts
    const suggestions = [];
    if (activeAlerts.length > 0 || downDevices.length > 0) {
      const hostList = downDevices.slice(0, 5).map((d) => `${escapeHtml(d.name)} (${escapeHtml(d.ip)})`).join(', ');
      suggestions.push({
        priority: 'CRITICAL',
        title: `Resolve ${activeAlerts.length} Active Network Incident(s)`,
        detail: `${downDevices.length > 0 ? `Currently offline hosts: <strong>${hostList}</strong>. ` : ''}Dispatch field technicians or verify power/switch port link states immediately. Once verified, mark stale incidents as resolved in the NetPulse Alerts console.`
      });
    } else {
      suggestions.push({
        priority: 'OPTIMAL',
        title: 'Zero Unresolved Outage Alarms',
        detail: `All <strong>${devices.length} monitored network assets</strong> are currently online and responding to ICMP/TCP telemetry probes without active alarms.`
      });
    }

    if (resolvedAlerts.length > 5) {
      suggestions.push({
        priority: 'RECOMMENDED',
        title: 'Post-Incident Root Cause Review & Log Hygiene',
        detail: `There are <strong>${resolvedAlerts.length} resolved historical alerts</strong> in the incident log. Review recurring outage timestamps to identify ISP maintenance windows or power fluctuations, then archive resolved logs.`
      });
    }

    suggestions.push({
      priority: 'RECOMMENDED',
      title: 'Real-Time Auto-Alert Verification',
      detail: 'NetPulse Real-Time Outage & Recovery Auto-Emailing is active. Any future host going DOWN or recovering UP will automatically notify your saved NOC recipient list.'
    });

    const rowsHtml = alerts
      .slice(0, 35)
      .map((a, idx) => {
        const isResolved = Boolean(a.resolved);
        const badgeBg = isResolved ? '#dcfce7' : '#ffe4e6';
        const badgeColor = isResolved ? '#15803d' : '#be123c';
        const statusText = isResolved ? 'RESOLVED' : 'ACTIVE OUTAGE';
        const rowBg = !isResolved ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-family: Consolas, monospace; font-size: 11px; color: #475569;">
              ${new Date(a.timestamp).toLocaleString()}
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #0f172a;">
              ${escapeHtml(a.device?.name || a.deviceName || 'Network Host')}
            </td>
            <td style="padding: 10px 12px; font-family: Consolas, monospace; font-size: 12px; color: #0284c7;">
              ${escapeHtml(a.device?.ip || a.deviceIp || '-')}
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #334155;">
              ${escapeHtml(a.message || 'Host unreachable / ICMP timeout')}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 999px;">
                ${statusText}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const sectionsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 12px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.7px;">
              🚨 Network Incident &amp; Alert Audit Log (Latest 35 Events)
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Timestamp</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Endpoint</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">IP Address</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Diagnostic Reason</th>
                  <th align="center" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">State</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #059669; font-weight: 700;">✓ No network alerts or outages recorded.</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>
      </table>
    `;

    const html = buildCorporateEmailLayout({
      categoryLabel: 'NETPULSE NOC • INCIDENT COMMAND BRIEFING',
      title: 'Network Outages & Incident Alert Report',
      subtitle: 'Real-Time Endpoint Reachability, Outage Alarms & Resolution Status',
      statusBadgeText: activeAlerts.length > 0 ? `${activeAlerts.length} ACTIVE INCIDENT(S)` : 'ALL SYSTEMS NORMAL',
      statusBadgeBg: activeAlerts.length > 0 ? '#e11d48' : '#10b981',
      accentColor: activeAlerts.length > 0 ? '#e11d48' : '#10b981',
      introParagraph: `This automated Incident Command briefing summarizes all current and recent network reachability alerts across your <strong>${devices.length} monitored endpoints</strong>. At the time of dispatch, there are <strong>${activeAlerts.length} active incident(s)</strong>, <strong>${downDevices.length} offline host(s)</strong>, and <strong>${resolvedAlerts.length} resolved historical events</strong>.`,
      kpiCards: [
        {
          label: 'Active Incidents',
          value: `${activeAlerts.length}`,
          subtext: activeAlerts.length > 0 ? 'Requires Attention' : 'Zero Active Alarms',
          color: activeAlerts.length > 0 ? '#e11d48' : '#059669'
        },
        {
          label: 'Offline Endpoints',
          value: `${downDevices.length}`,
          subtext: `Out of ${devices.length} Monitored`,
          color: downDevices.length > 0 ? '#d97706' : '#059669'
        },
        {
          label: 'Resolved Incidents',
          value: `${resolvedAlerts.length}`,
          subtext: 'Recovered / Mitigated',
          color: '#059669'
        },
        {
          label: 'Mitigation Rate',
          value: `${alerts.length > 0 ? Math.round((resolvedAlerts.length / alerts.length) * 100) : 100}%`,
          subtext: `${alerts.length} Total Logged Events`,
          color: '#0284c7'
        }
      ],
      suggestionsTitle: 'NOC Incident Response & Triage Recommendations',
      suggestions,
      sectionsHtml
    });

    return this.dispatchMail({
      type: 'ALERTS_REPORT',
      subject: `[NetPulse NOC] Network Outages & Incident Report (${activeAlerts.length} Active) - ${new Date().toLocaleDateString()}`,
      html,
      text: `NetPulse Alerts Summary: ${activeAlerts.length} Active Incidents, ${downDevices.length} Offline Devices.`,
      recipients
    });
  }

  // =========================================================================
  // 3. CYBERSECURITY, PORT VULNERABILITY & THREAT AUDIT REPORT EMAIL
  // =========================================================================
  async sendSecurityReportNow({ recipients = null } = {}) {
    const devices = await dataStore.getDevices();
    const overview = await securityService.getSecurityOverview(devices);
    const threats = securityService.getThreatAlerts().slice(0, 30);

    // Dynamic SecOps Recommendations
    const suggestions = [];
    if (overview.vulnerableDevicesCount > 0 || overview.totalOpenPorts > 0) {
      suggestions.push({
        priority: 'CRITICAL',
        title: `Harden ${overview.vulnerableDevicesCount} Host(s) with ${overview.totalOpenPorts} Exposed Service Port(s)`,
        detail: `Exposed ports (such as SMB 445, RDP 3389, RPC 135, or Telnet/FTP) increase lateral movement risk. Open the <strong>NetPulse Security Hub &rarr; 1-Click Remediation</strong> modal to generate and execute the automated Windows PowerShell / Linux UFW firewall lockdown script.`
      });
    }
    if (overview.criticalRiskDevices > 0) {
      suggestions.push({
        priority: 'HIGH',
        title: `Isolate or Patch ${overview.criticalRiskDevices} High/Critical Risk Endpoint(s)`,
        detail: `Critical severity exposures were flagged during the port and policy audit. Restrict administrative services (RDP/SSH/SMB) to authorized management VLANs only and disable legacy SMBv1/NetBIOS protocols.`
      });
    }
    if (threats.some((t) => (t.title || '').toLowerCase().includes('policy') || (t.title || '').toLowerCase().includes('search'))) {
      suggestions.push({
        priority: 'HIGH',
        title: 'Enforce Endpoint Web & DNS Policy Controls',
        detail: 'Active policy alerts indicate users accessed restricted or critical web resources. Review the User Searches inspector and block flagged domains at your perimeter firewall or DNS resolver.'
      });
    }
    suggestions.push({
      priority: overview.networkScore >= 85 ? 'OPTIMAL' : 'RECOMMENDED',
      title: 'Zero-Trust Layer-2 ARP Guard & Decoy Honeypot Defense',
      detail: `Current Network Cyber Score is <strong>${overview.networkScore}/100 (${overview.networkThreatLevel})</strong>. Keep the NetPulse Decoy Honeypot sensor active to trap unauthorized internal port scanners and monitor ARP tables for MAC spoofing.`
    });

    const threatRows = threats
      .map((t, idx) => {
        const isCrit = t.severity === 'CRITICAL';
        const badgeBg = isCrit ? '#ffe4e6' : '#fef3c7';
        const badgeCol = isCrit ? '#be123c' : '#b45309';
        const rowBg = isCrit ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-family: Consolas, monospace; font-size: 11px; color: #475569;">
              ${new Date(t.timestamp || Date.now()).toLocaleString()}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeCol}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
                ${escapeHtml(t.severity || 'HIGH')}
              </span>
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #0f172a;">
              ${escapeHtml(t.deviceName || t.deviceIp || 'Endpoint')}
              <div style="font-family: Consolas, monospace; font-size: 10px; color: #0284c7;">${escapeHtml(t.deviceIp || '')}</div>
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #be123c;">
              ${escapeHtml(t.title || t.service || 'Security Alert')}
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #334155; line-height: 1.45;">
              ${escapeHtml(t.description || '')}
              ${t.recommendation ? `<div style="margin-top: 3px; font-size: 10px; color: #059669; font-weight: 600;">Fix: ${escapeHtml(t.recommendation)}</div>` : ''}
            </td>
          </tr>
        `;
      })
      .join('');

    const sectionsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 12px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.7px;">
              🛡️ Detected Cyber Threats, Exposed Ports &amp; Policy Violations
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Timestamp</th>
                  <th align="center" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Severity</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Target Host</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Threat / Vector</th>
                  <th align="left" style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Diagnostic &amp; Remediation</th>
                </tr>
              </thead>
              <tbody>
                ${threatRows || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #059669; font-weight: 700;">✓ Zero active cybersecurity threats or exposed risk ports detected.</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>
      </table>
    `;

    const isSafe = overview.networkScore >= 80;
    const html = buildCorporateEmailLayout({
      categoryLabel: 'NETPULSE CYBER SOC • VULNERABILITY & THREAT AUDIT',
      title: 'Enterprise Cybersecurity & Attack Surface Report',
      subtitle: `Port Exposure Analysis, Layer-2 ARP Integrity & Active Threat Log`,
      statusBadgeText: `SCORE: ${overview.networkScore}/100 (${overview.networkThreatLevel})`,
      statusBadgeBg: isSafe ? '#10b981' : '#e11d48',
      accentColor: isSafe ? '#0ea5e9' : '#e11d48',
      introParagraph: `Please review the latest <strong>Cybersecurity &amp; Attack Surface Posture Report</strong> generated by the NetPulse Autonomous SOC Engine. Across <strong>${overview.totalAuditedDevices || devices.length} audited endpoints</strong>, your network currently holds a Cyber Defense Score of <strong>${overview.networkScore}/100 (${overview.networkThreatLevel})</strong>, with <strong>${overview.vulnerableDevicesCount} host(s)</strong> exposing <strong>${overview.totalOpenPorts} open service port(s)</strong> and <strong>${overview.threatAlertsCount} active threat alert(s)</strong>.`,
      kpiCards: [
        {
          label: 'Cyber Defense Score',
          value: `${overview.networkScore}/100`,
          subtext: `Posture: ${overview.networkThreatLevel}`,
          color: overview.networkScore >= 80 ? '#059669' : '#e11d48'
        },
        {
          label: 'Vulnerable Hosts',
          value: `${overview.vulnerableDevicesCount}`,
          subtext: `${overview.criticalRiskDevices || 0} Critical Risk`,
          color: overview.vulnerableDevicesCount > 0 ? '#e11d48' : '#059669'
        },
        {
          label: 'Exposed Service Ports',
          value: `${overview.totalOpenPorts}`,
          subtext: 'Open TCP Risk Vectors',
          color: overview.totalOpenPorts > 0 ? '#d97706' : '#059669'
        },
        {
          label: 'Active SOC Threats',
          value: `${overview.threatAlertsCount}`,
          subtext: 'Unresolved Security Events',
          color: overview.threatAlertsCount > 0 ? '#7c3aed' : '#059669'
        }
      ],
      suggestionsTitle: 'SecOps Hardening & Firewall Remediation Plan',
      suggestions,
      sectionsHtml
    });

    return this.dispatchMail({
      type: 'SECURITY_REPORT',
      subject: `[NetPulse Cyber SOC] Security & Vulnerability Audit Report (Score: ${overview.networkScore}/100) - ${new Date().toLocaleDateString()}`,
      html,
      text: `NetPulse Security Audit: Score ${overview.networkScore}/100, Vulnerable Hosts: ${overview.vulnerableDevicesCount}, Active Threats: ${overview.threatAlertsCount}.`,
      recipients
    });
  }

  // =========================================================================
  // 4. USER SEARCHES, PROFILES & RESTRICTED/CRITICAL POLICY REPORT EMAIL
  // =========================================================================
  async sendUserSearchReportNow({ recipients = null, deviceIp = null } = {}) {
    let records = [];
    let targetEndpoint = null;

    if (deviceIp) {
      targetEndpoint = securityService.getEndpointData(deviceIp);
      if (targetEndpoint) {
        records = [
          ...(targetEndpoint.searches || []),
          ...(targetEndpoint.webActivity || [])
        ];
      }
    }

    if (records.length === 0) {
      records = securityService.getDnsTrafficRecords(500);
      if (deviceIp) {
        records = records.filter((r) => r.clientIp === deviceIp);
      }
    }

    const totalEvents = records.length;
    const exactSearches = records.filter((r) => r.searchQuery && String(r.searchQuery).trim());
    const restrictedHits = records.filter(
      (r) => r.threatLevel === 'SUSPICIOUS' || r.threatLevel === 'RESTRICTED'
    );
    const criticalHits = records.filter(
      (r) => r.threatLevel === 'MALICIOUS' || r.threatLevel === 'CRITICAL'
    );
    const incognitoHits = records.filter(
      (r) => Boolean(r.isIncognito) || (r.browser || '').toLowerCase().includes('incognito')
    );

    const pingReport = securityService.getEndpointPingReport(deviceIp || '');
    const epHost = targetEndpoint?.hostname || pingReport.hostname || 'Workstation';
    const epUser = targetEndpoint?.activeUser || pingReport.activeUser || 'Active User';
    const epIp = targetEndpoint?.ip || deviceIp || pingReport.ip;
    const scopeLabel = deviceIp ? `${epHost} (${epUser} • ${epIp})` : 'All Connected Office Workstations';

    // Dynamic Policy & User Activity Suggestions
    const suggestions = [];
    if (criticalHits.length > 0) {
      const topCritUsers = Array.from(new Set(criticalHits.map((c) => `${c.winUser || c.profileName || epUser} (${c.clientIp || epIp})`))).slice(0, 4).join(', ');
      suggestions.push({
        priority: 'CRITICAL',
        title: `Investigate ${criticalHits.length} Critical Policy Violation(s) Immediately`,
        detail: `High-risk or prohibited searches/domains were accessed by: <strong>${escapeHtml(topCritUsers)}</strong>. Enforce DNS sinkholing or perimeter firewall URL filtering for these domains and conduct an endpoint compliance review.`
      });
    }
    if (restrictedHits.length > 0) {
      suggestions.push({
        priority: 'HIGH',
        title: `Review ${restrictedHits.length} Restricted Website / Keyword Access Event(s)`,
        detail: `Policy-restricted websites or keywords were accessed on <strong>${escapeHtml(epHost)}</strong>. Review custom keyword rules in <strong>User Searches &rarr; Restricted &amp; Critical Rules</strong> to fine-tune corporate acceptable-use policies.`
      });
    }
    if (incognitoHits.length > 0) {
      suggestions.push({
        priority: 'RECOMMENDED',
        title: `${incognitoHits.length} Incognito / Private DNS Lookup(s) Captured`,
        detail: `Private browsing sessions bypass standard browser history but were successfully captured via OS-level DNS cache telemetry. Consider disabling Incognito mode via Windows Group Policy on corporate workstations.`
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'OPTIMAL',
        title: '100% Acceptable-Use Policy Compliance',
        detail: `Across <strong>${totalEvents} captured web/search telemetry events</strong> on <strong>${escapeHtml(scopeLabel)}</strong>, zero Restricted or Critical policy violations were detected.`
      });
    }

    // Prioritize Critical, Restricted, and Exact Searches in the email table
    const prioritized = [
      ...criticalHits,
      ...restrictedHits,
      ...exactSearches.filter((r) => r.threatLevel === 'SAFE')
    ].slice(0, 50);

    const rowsHtml = prioritized
      .map((item, idx) => {
        const isCrit = item.threatLevel === 'MALICIOUS' || item.threatLevel === 'CRITICAL';
        const isRest = item.threatLevel === 'SUSPICIOUS' || item.threatLevel === 'RESTRICTED';
        const badgeBg = isCrit ? '#ffe4e6' : isRest ? '#fef3c7' : '#e0f2fe';
        const badgeCol = isCrit ? '#be123c' : isRest ? '#b45309' : '#0369a1';
        const statusLabel = isCrit ? 'CRITICAL' : isRest ? 'RESTRICTED' : 'SAFE SEARCH';
        const rowBg = isCrit ? '#fff1f2' : isRest ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 9px 10px; font-family: Consolas, monospace; font-size: 11px; color: #475569;">
              ${new Date(item.timestamp).toLocaleTimeString()}
            </td>
            <td style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #0f172a;">
              PC User: ${escapeHtml(item.winUser || item.profileName || epUser)}
              <div style="font-size: 10px; color: #475569; font-weight: 600;">Desktop: ${escapeHtml(item.hostname || epHost)} • <span style="font-family: Consolas, monospace; color: #0284c7;">${escapeHtml(item.clientIp || epIp)}</span></div>
              ${item.profileEmail ? `<div style="font-family: Consolas, monospace; font-size: 10px; color: #6366f1;">${escapeHtml(item.profileEmail)}</div>` : ''}
            </td>
            <td style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #334155;">
              ${escapeHtml(item.browser || 'Browser')}
            </td>
            <td style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #0f172a;">
              ${item.searchQuery ? `<strong>"${escapeHtml(item.searchQuery)}"</strong>` : escapeHtml(item.pageTitle || item.domain)}
              <div style="font-family: Consolas, monospace; font-size: 10px; color: #64748b;">${escapeHtml(item.domain)}</div>
            </td>
            <td style="padding: 9px 10px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeCol}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
                ${statusLabel}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const pingEndpoints = Array.isArray(pingReport.allEndpoints) ? pingReport.allEndpoints : [];
    const isSingle = Boolean(deviceIp || pingReport.isSingleEndpoint);

    const pingSectionHtml = isSingle
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 18px;">
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 11px 16px; color: #ffffff;">
              <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
                📡 Endpoint Continuous WAN Reachability &amp; Latency (8.8.8.8 &bull; 1.1.1.1)
              </strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.8;">
              <strong>Workstation:</strong> ${escapeHtml(epHost)} &bull; <strong>Active User:</strong> <span style="color:#4338ca; font-weight:700;">${escapeHtml(epUser)}</span> &bull; <strong>IP:</strong> <code style="color:#0284c7;">${escapeHtml(epIp)}</code><br/>
              <strong>Google DNS 8.8.8.8:</strong> <span style="font-family:Consolas, monospace; font-weight:700; color:#0284c7;">${escapeHtml(pingReport.latestGoogle)}</span> &bull; 
              <strong>Cloudflare 1.1.1.1:</strong> <span style="font-family:Consolas, monospace; font-weight:700; color:#d97706;">${escapeHtml(pingReport.latestCloudflare)}</span> &bull; 
              <strong>Jitter:</strong> ${escapeHtml(pingReport.latestJitter)} &bull; 
              <strong>Packet Loss:</strong> ${escapeHtml(pingReport.latestLoss)} &bull; 
              <strong>WAN Uptime:</strong> <strong style="color:${(pingReport.outageCount || 0) > 0 ? '#e11d48' : '#059669'};">${escapeHtml(pingReport.uptimePercentage || '100%')}</strong>
            </td>
          </tr>
        </table>`
      : (pingEndpoints.length > 0
          ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 18px;">
              <tr>
                <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 11px 16px; color: #ffffff;">
                  <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
                    🌐 Connected Endpoints WAN Reachability Summary (${pingEndpoints.length} Workstations)
                  </strong>
                </td>
              </tr>
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <thead>
                      <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Endpoint</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">User</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">8.8.8.8 Ping</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">1.1.1.1 Ping</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Loss / Jitter</th>
                        <th align="center" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pingEndpoints.map((ep, idx) => `
                        <tr bgcolor="${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}" style="border-bottom: 1px solid #e2e8f0;">
                          <td style="padding: 8px 10px; font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(ep.hostname)}<div style="font-size: 10px; color: #0284c7;">${escapeHtml(ep.ip)}</div></td>
                          <td style="padding: 8px 10px; font-size: 11px; color: #4338ca;">${escapeHtml(ep.activeUser)}</td>
                          <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #0284c7;">${escapeHtml(ep.googlePing)}</td>
                          <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #d97706;">${escapeHtml(ep.cloudflarePing)}</td>
                          <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; color: #334155;">${escapeHtml(ep.packetLoss)} / ±${escapeHtml(ep.jitter)}</td>
                          <td style="padding: 8px 10px; text-align: center;"><span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800; background:#d1fae5; color:#047857;">${escapeHtml(ep.status)}</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>`
          : '');

    const sectionsHtml = `
      ${pingSectionHtml}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 12px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.7px;">
              🔍 User Search Queries, Logged-In Profiles &amp; Policy Audit Log (${escapeHtml(scopeLabel)})
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Time</th>
                  <th align="left" style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">PC User &amp; Desktop</th>
                  <th align="left" style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Browser</th>
                  <th align="left" style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Exact Search / Domain</th>
                  <th align="center" style="padding: 9px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #475569; text-transform: uppercase;">Policy Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No user searches recorded yet for ${escapeHtml(scopeLabel)}.</td></tr>`}
              </tbody>
            </table>
          </td>
        </tr>
      </table>
    `;

    const hasViolations = criticalHits.length > 0 || restrictedHits.length > 0;
    const html = buildCorporateEmailLayout({
      categoryLabel: deviceIp
        ? 'NETPULSE ENDPOINT TELEMETRY • INDIVIDUAL USER SEARCH & POLICY AUDIT'
        : 'NETPULSE ENDPOINT TELEMETRY • USER ACTIVITY & WAN PING AUDIT',
      title: deviceIp
        ? `User Search & Policy Report: ${epHost} (${epUser})`
        : 'User Searches, WAN Ping Telemetry & Policy Compliance Report',
      subtitle: `Scope: ${scopeLabel} • Exact Search Queries, Incognito & Policy Violations`,
      statusBadgeText: criticalHits.length > 0 ? `${criticalHits.length} CRITICAL VIOLATIONS` : hasViolations ? `${restrictedHits.length} RESTRICTED HITS` : 'POLICY COMPLIANT',
      statusBadgeBg: criticalHits.length > 0 ? '#e11d48' : hasViolations ? '#d97706' : '#10b981',
      accentColor: criticalHits.length > 0 ? '#e11d48' : '#0ea5e9',
      introParagraph: `Please find below the <strong>User Search &amp; Acceptable-Use Policy Audit Report</strong> for <strong>${escapeHtml(scopeLabel)}</strong>. NetPulse endpoint telemetry inspected <strong>${totalEvents} web activity records</strong>, identifying <strong>${exactSearches.length} exact search queries</strong>, <strong>${incognitoHits.length} Incognito/DNS sessions</strong>, <strong>${restrictedHits.length} Restricted policy hits</strong>, and <strong>${criticalHits.length} Critical violations</strong>.`,
      kpiCards: [
        {
          label: 'Exact User Searches',
          value: `${exactSearches.length}`,
          subtext: `From ${totalEvents} Web Events`,
          color: '#0284c7'
        },
        {
          label: 'Endpoint WAN Uptime',
          value: `${pingReport.uptimePercentage || '100%'}`,
          subtext: `${pingReport.outageCount || 0} Outages • ${pingReport.totalProbes || 0} Probes`,
          color: (pingReport.outageCount || 0) > 0 ? '#e11d48' : '#059669'
        },
        {
          label: 'Restricted Policy Hits',
          value: `${restrictedHits.length}`,
          subtext: 'Warning / Restricted Sites',
          color: restrictedHits.length > 0 ? '#d97706' : '#059669'
        },
        {
          label: 'Critical Violations',
          value: `${criticalHits.length}`,
          subtext: 'High-Risk Keywords/Sites',
          color: criticalHits.length > 0 ? '#e11d48' : '#059669'
        }
      ],
      suggestionsTitle: 'Endpoint Compliance & Acceptable-Use Recommendations',
      suggestions,
      sectionsHtml
    });

    const subject = deviceIp
      ? `[NetPulse Audit] User Searches & Policy Report: ${epHost} (${epUser} • ${epIp}) - ${criticalHits.length} Critical, ${restrictedHits.length} Restricted`
      : `[NetPulse Audit] User Searches, WAN Ping & Policy Report (${criticalHits.length} Critical, ${restrictedHits.length} Restricted) - ${new Date().toLocaleDateString()}`;

    return this.dispatchMail({
      type: 'USER_SEARCH_REPORT',
      subject,
      html,
      text: `NetPulse User Search Report for ${scopeLabel}: WAN Uptime ${pingReport.uptimePercentage || '100%'}, ${totalEvents} total events, ${exactSearches.length} searches, ${restrictedHits.length} restricted, ${criticalHits.length} critical.`,
      recipients
    });
  }

  // =========================================================================
  // 4B. DEDICATED ENDPOINT CONTINUOUS WAN PING & OUTAGE REPORT EMAIL
  // =========================================================================
  async sendEndpointPingReportNow({ recipients = null, deviceIp = null, isAuto = false } = {}) {
    const report = securityService.getEndpointPingReport(deviceIp || '');
    const entries = Array.isArray(report.entries) ? report.entries : [];
    const allEndpoints = Array.isArray(report.allEndpoints) ? report.allEndpoints : [];
    const pingHealth = report.pingHealth || {};
    const scopeLabel = `${report.hostname || 'Workstation'} (${report.ip}) • Active User: ${report.activeUser || 'Active User'}`;

    const gPing = report.latestGoogle || pingHealth?.googleDns?.avgLatency || '18ms';
    const cfPing = report.latestCloudflare || pingHealth?.cloudflareDns?.avgLatency || '3ms';
    const jitter = report.latestJitter || pingHealth?.jitter || '1ms';
    const loss = report.latestLoss || pingHealth?.packetLoss || '0%';

    const suggestions = [];
    if (report.outageCount > 0) {
      suggestions.push({
        priority: 'CRITICAL',
        title: `${report.outageCount} Endpoint WAN Internet Outage(s) Recorded`,
        detail: `Workstation <strong>${escapeHtml(report.hostname)} (${escapeHtml(report.ip)})</strong> experienced complete packet loss to both <code>8.8.8.8</code> and <code>1.1.1.1</code> during <strong>${report.outageCount} probe window(s)</strong>. Inspect ISP uplink stability, NAT gateway session tables, and local Wi-Fi/Ethernet physical links.`
      });
    }
    if (report.degradedCount > 0) {
      suggestions.push({
        priority: 'HIGH',
        title: `${report.degradedCount} Degraded WAN Latency / Packet Loss Event(s)`,
        detail: `Intermittent packet loss or elevated jitter (<strong>±${escapeHtml(jitter)}</strong>) was detected on <strong>${escapeHtml(report.hostname)}</strong>. Check for bandwidth saturation or QoS throttling on the access switch.`
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'OPTIMAL',
        title: `100% Continuous Endpoint WAN Reachability (${report.uptimePercentage})`,
        detail: `Across <strong>${report.totalProbes} continuous background ICMP probes</strong> to Google DNS (<code>8.8.8.8</code> avg <strong>${escapeHtml(gPing)}</strong>) and Cloudflare DNS (<code>1.1.1.1</code> avg <strong>${escapeHtml(cfPing)}</strong>), zero internet blackouts occurred.`
      });
    }

    const fleetRowsHtml = allEndpoints
      .map((ep, idx) => {
        const isDown = ep.isOutage || ep.status === 'INTERNET DOWN';
        const isDeg = ep.isDegraded;
        const rowBg = isDown ? '#fff1f2' : isDeg ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const badgeBg = isDown ? '#ffe4e6' : isDeg ? '#fef3c7' : '#d1fae5';
        const badgeCol = isDown ? '#be123c' : isDeg ? '#b45309' : '#047857';
        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 700; color: #0f172a;">
              ${escapeHtml(ep.hostname || ep.ip)}
              <div style="font-family: Consolas, monospace; font-size: 10px; color: #0284c7;">${escapeHtml(ep.ip)}</div>
            </td>
            <td style="padding: 8px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 700; color: #4338ca;">
              ${escapeHtml(ep.activeUser || 'User')}
            </td>
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #0284c7;">
              ${escapeHtml(ep.googlePing || '4ms')}
            </td>
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #d97706;">
              ${escapeHtml(ep.cloudflarePing || '3ms')}
            </td>
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; color: #334155;">
              ±${escapeHtml(ep.jitter || '1ms')} / ${escapeHtml(ep.packetLoss || '0%')}
            </td>
            <td style="padding: 8px 10px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeCol}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
                ${escapeHtml(ep.status || 'ONLINE')}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const probeRowsHtml = entries
      .slice(-40)
      .reverse()
      .map((e, idx) => {
        const isDown = e.isOutage;
        const isDeg = e.isDegraded;
        const rowBg = isDown ? '#fff1f2' : isDeg ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const badgeBg = isDown ? '#ffe4e6' : isDeg ? '#fef3c7' : '#d1fae5';
        const badgeCol = isDown ? '#be123c' : isDeg ? '#b45309' : '#047857';
        const statusText = isDown ? 'INTERNET DOWN' : isDeg ? 'DEGRADED' : 'ONLINE';
        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; color: #475569;">
              #${e.id} • ${escapeHtml(e.timestamp)}
            </td>
            <td style="padding: 8px 10px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 700; color: #334155;">
              ${escapeHtml(e.user || report.activeUser)}
            </td>
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #0284c7;">
              ${escapeHtml(e.googlePing)}
            </td>
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; font-weight: 700; color: #d97706;">
              ${escapeHtml(e.cloudflarePing)}
            </td>
            <td style="padding: 8px 10px; font-family: Consolas, monospace; font-size: 11px; color: #334155;">
              ±${escapeHtml(e.jitter)} (${escapeHtml(e.packetLoss)} loss)
            </td>
            <td style="padding: 8px 10px; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeCol}; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
                ${statusText}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const sectionsHtml = `
      ${
        allEndpoints.length > 0
          ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 18px;">
              <tr>
                <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 11px 16px; color: #ffffff;">
                  <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
                    🖥️ Connected Endpoints WAN Ping Summary (${allEndpoints.length} Workstation${allEndpoints.length === 1 ? '' : 's'})
                  </strong>
                </td>
              </tr>
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <thead>
                      <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Hostname / IP</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Active User</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">8.8.8.8 Ping</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">1.1.1.1 Ping</th>
                        <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Jitter / Loss</th>
                        <th align="center" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${fleetRowsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>`
          : ''
      }
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 11px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
              📡 Continuous WAN Ping &amp; Outage Probe Chronology (${escapeHtml(report.hostname)} • ${escapeHtml(report.ip)})
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Probe / Timestamp</th>
                  <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">User Session</th>
                  <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Google 8.8.8.8</th>
                  <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Cloudflare 1.1.1.1</th>
                  <th align="left" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">Jitter / Packet Loss</th>
                  <th align="center" style="padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase;">WAN Status</th>
                </tr>
              </thead>
              <tbody>
                ${probeRowsHtml || '<tr><td colspan="6" style="padding: 18px; text-align: center; color: #64748b;">No ping probe samples recorded yet.</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>
      </table>
    `;

    const html = buildCorporateEmailLayout({
      categoryLabel: isAuto
        ? 'NETPULSE AUTOMATED WAN WATCHDOG • ENDPOINT PING & OUTAGE AUDIT'
        : 'NETPULSE ENDPOINT TELEMETRY • CONTINUOUS WAN PING & OUTAGE REPORT',
      title: `Endpoint Continuous WAN Ping & Outage Report (${report.hostname})`,
      subtitle: `Scope: ${scopeLabel} • Google 8.8.8.8 & Cloudflare 1.1.1.1 SLA Verification`,
      statusBadgeText:
        report.outageCount > 0
          ? `${report.outageCount} WAN OUTAGES`
          : report.degradedCount > 0
            ? `${report.degradedCount} DEGRADED PROBES`
            : `100% WAN ONLINE`,
      statusBadgeBg: report.outageCount > 0 ? '#e11d48' : report.degradedCount > 0 ? '#d97706' : '#10b981',
      accentColor: report.outageCount > 0 ? '#e11d48' : '#0284c7',
      introParagraph: `Please find below the <strong>Continuous WAN Ping &amp; Internet Outage Telemetry Report</strong> for <strong>${escapeHtml(report.hostname)} (${escapeHtml(report.ip)})</strong>, active user <strong>${escapeHtml(report.activeUser)}</strong>. Across <strong>${report.totalProbes} continuous probes</strong>, WAN availability achieved <strong>${escapeHtml(report.uptimePercentage)}</strong> with <strong>${report.outageCount} internet blackout(s)</strong> and <strong>${report.degradedCount} degraded packet loss window(s)</strong>.`,
      kpiCards: [
        {
          label: 'WAN Uptime SLA',
          value: `${report.uptimePercentage}`,
          subtext: `${report.totalProbes} Continuous Probes`,
          color: report.outageCount > 0 ? '#d97706' : '#059669'
        },
        {
          label: 'Google DNS 8.8.8.8',
          value: `${gPing}`,
          subtext: `Packet Loss: ${loss}`,
          color: '#0284c7'
        },
        {
          label: 'Cloudflare 1.1.1.1',
          value: `${cfPing}`,
          subtext: `Jitter: ±${jitter}`,
          color: '#d97706'
        },
        {
          label: 'Recorded Outages',
          value: `${report.outageCount}`,
          subtext: `${report.degradedCount} Degraded Probes`,
          color: report.outageCount > 0 ? '#e11d48' : '#059669'
        }
      ],
      suggestionsTitle: 'Endpoint WAN Connectivity & ISP Diagnostics',
      suggestions,
      sectionsHtml
    });

    return this.dispatchMail({
      type: isAuto ? 'AUTO_PING_REPORT' : 'ENDPOINT_PING_REPORT',
      subject: `[NetPulse Ping Audit] ${report.hostname} (${report.activeUser} • ${report.ip}) - ${report.uptimePercentage} WAN Uptime`,
      html,
      text: `NetPulse Endpoint Ping Report for ${report.hostname} (${report.ip}), Active User: ${report.activeUser}: Uptime ${report.uptimePercentage}, 8.8.8.8 Avg ${gPing}, 1.1.1.1 Avg ${cfPing}, Outages ${report.outageCount}.`,
      recipients
    });
  }

  async notifyAgentPingTelemetry(endpointEntry) {
    if (!this.config.enabled || !this.isSmtpConfigured() || !endpointEntry) return false;
    const ph = endpointEntry.pingHealth || {};
    const isOutage = Boolean(ph.isOutage);
    const isDegraded = Boolean(ph.isDegraded);

    // Immediately auto-send Ping Report if an internet outage or degraded WAN state is reported by the agent (15m cooldown)
    if (isOutage || isDegraded) {
      const alertKey = `agent_ping_alert_${endpointEntry.ip}_${isOutage ? 'DOWN' : 'DEG'}`;
      if (this.canTriggerCooldown(alertKey, 15 * 60 * 1000)) {
        try {
          await this.sendEndpointPingReportNow({ deviceIp: endpointEntry.ip, isAuto: true });
          return true;
        } catch (_) {
          return false;
        }
      }
    }

    // Also auto-dispatch periodic Endpoint Ping Report when the 30-min agent syncs (6-hour cooldown per endpoint)
    const periodicKey = `agent_ping_periodic_${endpointEntry.ip}`;
    if (this.canTriggerCooldown(periodicKey, 6 * 60 * 60 * 1000)) {
      try {
        await this.sendEndpointPingReportNow({ deviceIp: endpointEntry.ip, isAuto: true });
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  // =========================================================================
  // 5. REAL-TIME AUTO-EMAIL DISPATCHERS (OUTAGE, SECURITY, CRITICAL SEARCH)
  // =========================================================================
  canTriggerCooldown(key, cooldownMs = 300000) {
    const now = Date.now();
    const last = this.cooldownMap.get(key) || 0;
    if (now - last < cooldownMs) return false;
    this.cooldownMap.set(key, now);
    return true;
  }

  async notifyDeviceOutageOrRecovery({ deviceName, deviceIp, status, message, latency, timestamp }) {
    if (!this.config.autoSendOutageAlerts || !this.isSmtpConfigured()) return false;
    const key = `outage_${deviceIp}_${status}`;
    if (!this.canTriggerCooldown(key, 10 * 60 * 1000)) return false;

    const isDown = status === 'DOWN';
    const subject = isDown
      ? `🚨 [NetPulse OUTAGE ALERT] ${deviceName} (${deviceIp}) is DOWN`
      : `✅ [NetPulse RECOVERY] ${deviceName} (${deviceIp}) is back ONLINE`;

    const suggestions = isDown
      ? [
          {
            priority: 'CRITICAL',
            title: 'Step 1: Verify Physical Power & Switch Link Status',
            detail: `Confirm that <strong>${escapeHtml(deviceName)} (${escapeHtml(deviceIp)})</strong> is powered on and its Ethernet/SFP port LED is active on the local distribution switch.`
          },
          {
            priority: 'HIGH',
            title: 'Step 2: Check Local Firewall & Subnet Routing',
            detail: `Run <code>ping ${escapeHtml(deviceIp)}</code> and <code>tracert ${escapeHtml(deviceIp)}</code> from the NOC console to isolate whether the drop is at the gateway or endpoint firewall.`
          }
        ]
      : [
          {
            priority: 'OPTIMAL',
            title: 'Endpoint Reachability Restored',
            detail: `Host <strong>${escapeHtml(deviceName)} (${escapeHtml(deviceIp)})</strong> responded to telemetry probes (Latency: <strong>${latency || 1}ms</strong>). Incident has been automatically marked as recovered.`
          }
        ];

    const sectionsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 11px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #ffffff; text-transform: uppercase;">
              📋 Real-Time Telemetry Diagnostic Summary
            </strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.7;">
            <strong>Endpoint Name:</strong> ${escapeHtml(deviceName)}<br/>
            <strong>IPv4 Address:</strong> <code style="color: #0284c7;">${escapeHtml(deviceIp)}</code><br/>
            <strong>Current State:</strong> <strong style="color: ${isDown ? '#e11d48' : '#059669'};">${escapeHtml(status)}</strong><br/>
            <strong>Diagnostic Detail:</strong> ${escapeHtml(message || (isDown ? 'ICMP Echo Timeout / Host Unreachable' : `Responding normally (${latency || 1}ms)`))}<br/>
            <strong>Event Timestamp:</strong> ${new Date(timestamp || Date.now()).toLocaleString()}
          </td>
        </tr>
      </table>
    `;

    const html = buildCorporateEmailLayout({
      categoryLabel: 'NETPULSE REAL-TIME NOC WATCHDOG • AUTOMATED EVENT ALERT',
      title: isDown ? `Host Outage Alert: ${deviceName} (${deviceIp})` : `Host Recovery Notice: ${deviceName} (${deviceIp})`,
      subtitle: 'Automated Real-Time Reachability State Transition Notification',
      statusBadgeText: isDown ? 'HOST DOWN' : 'HOST RECOVERED',
      statusBadgeBg: isDown ? '#e11d48' : '#10b981',
      accentColor: isDown ? '#e11d48' : '#10b981',
      introParagraph: isDown
        ? `NetPulse automated background monitoring detected that <strong>${escapeHtml(deviceName)} (${escapeHtml(deviceIp)})</strong> failed consecutive reachability probes and has transitioned to <strong>DOWN</strong> state. Please review the diagnostic details and recommended troubleshooting steps below.`
        : `Good news — <strong>${escapeHtml(deviceName)} (${escapeHtml(deviceIp)})</strong> has recovered from its previous outage and is now responding normally to network probes.`,
      kpiCards: [],
      suggestionsTitle: isDown ? 'Immediate Troubleshooting Checklist' : 'Recovery Verification',
      suggestions,
      sectionsHtml
    });

    try {
      await this.dispatchMail({
        type: isDown ? 'AUTO_OUTAGE_ALERT' : 'AUTO_RECOVERY_ALERT',
        subject,
        html,
        text: `${subject} - ${message || ''}`
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  async notifySecurityThreat(freshThreats = []) {
    if (!this.config.autoSendSecurityAlerts || !this.isSmtpConfigured()) return false;
    const highOrCrit = freshThreats.filter(
      (t) => t.severity === 'CRITICAL' || t.severity === 'HIGH'
    );
    if (highOrCrit.length === 0) return false;

    const first = highOrCrit[0];
    const key = `sec_${first.deviceIp}_${first.title}`;
    if (!this.canTriggerCooldown(key, 5 * 60 * 1000)) return false;

    const rowsHtml = highOrCrit
      .slice(0, 10)
      .map((t, idx) => {
        const isCrit = t.severity === 'CRITICAL';
        const rowBg = isCrit ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr bgcolor="${rowBg}" style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 800; color: ${isCrit ? '#be123c' : '#b45309'};">
              ${escapeHtml(t.severity)}
            </td>
            <td style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #0f172a;">
              ${escapeHtml(t.deviceName || t.deviceIp)}
            </td>
            <td style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #be123c;">
              ${escapeHtml(t.title)}
            </td>
            <td style="padding: 9px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #334155;">
              ${escapeHtml(t.description || '')}
            </td>
          </tr>
        `;
      })
      .join('');

    const suggestions = [
      {
        priority: 'CRITICAL',
        title: 'Recommended SOC Mitigation Action',
        detail: `${escapeHtml(first.recommendation || 'Inspect the affected endpoint in the NetPulse Security Hub or User Searches console, block unauthorized ports via firewall, and enforce corporate acceptable-use policies.')}`
      }
    ];

    const sectionsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <tr>
          <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 11px 16px; color: #ffffff;">
            <strong style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #ffffff; text-transform: uppercase;">
              🛡️ Real-Time Security &amp; Policy Alert Details
            </strong>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <thead>
                <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th align="left" style="padding: 8px 12px; font-size: 10px; color: #475569; text-transform: uppercase;">Severity</th>
                  <th align="left" style="padding: 8px 12px; font-size: 10px; color: #475569; text-transform: uppercase;">Endpoint</th>
                  <th align="left" style="padding: 8px 12px; font-size: 10px; color: #475569; text-transform: uppercase;">Alert Title</th>
                  <th align="left" style="padding: 8px 12px; font-size: 10px; color: #475569; text-transform: uppercase;">Details</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </td>
        </tr>
      </table>
    `;

    const subject = `🛡️ [NetPulse Security Alert] ${highOrCrit.length} High/Critical Threat(s) on ${first.deviceName || first.deviceIp}`;
    const html = buildCorporateEmailLayout({
      categoryLabel: 'NETPULSE CYBER SOC • REAL-TIME THREAT INTERCEPT',
      title: `${highOrCrit.length} High / Critical Security Alert(s) Detected`,
      subtitle: `Primary Target: ${first.deviceName || first.deviceIp} • Immediate SOC Review Recommended`,
      statusBadgeText: 'CRITICAL SOC ALERT',
      statusBadgeBg: '#e11d48',
      accentColor: '#e11d48',
      introParagraph: `NetPulse real-time security and policy sensors intercepted <strong>${highOrCrit.length} High/Critical severity event(s)</strong> on your network. Please review the alert details and recommended remediation steps below.`,
      kpiCards: [],
      suggestionsTitle: 'Immediate SOC Response Recommendation',
      suggestions,
      sectionsHtml
    });

    try {
      await this.dispatchMail({
        type: 'AUTO_SECURITY_ALERT',
        subject,
        html,
        text: `${subject}: ${first.title} on ${first.deviceName || first.deviceIp}`
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  startScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    this.schedulerTimer = setInterval(() => this.checkSchedule(), 60000);
  }

  async checkSchedule() {
    if (!this.config.enabled || !this.isSmtpConfigured()) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 1 = Monday

    if (currentHour !== Number(this.config.scheduledHour)) {
      return;
    }

    if (this.config.lastSentAt) {
      const last = new Date(this.config.lastSentAt);
      const isSameDay =
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate();
      if (isSameDay) return;
    }

    if (this.config.frequency === 'weekly' && currentDay !== 1) {
      return;
    }

    try {
      await this.sendReportNow();
      await this.sendEndpointPingReportNow({ isAuto: true }).catch(() => {});
      await this.sendUserSearchReportNow().catch(() => {});
    } catch (err) {
      console.error('[EmailReportService] Auto-dispatch failed:', err.message);
    }
  }
}

export default new EmailReportService();
