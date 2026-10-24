import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import reportService from './reportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const EMAIL_CONFIG_FILE = path.join(DATA_DIR, 'email_report_config.json');

const DEFAULT_CONFIG = {
  enabled: false,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  senderName: 'NetPulse Enterprise NOC',
  senderEmail: '',
  recipients: '',
  frequency: 'daily', // 'daily' | 'weekly'
  scheduledHour: 9,   // 9 AM
  daysToCover: 1,     // 1 day for daily, 7 for weekly
  lastSentAt: null,
  lastStatus: null,
  lastError: null
};

class EmailReportService {
  constructor() {
    this.initStorage();
    this.config = this.loadConfig();
    this.schedulerTimer = null;
    this.startScheduler();
  }

  initStorage() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(EMAIL_CONFIG_FILE)) {
      fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
  }

  loadConfig() {
    try {
      const data = fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(this.config, null, 2));
    return this.getPublicConfig();
  }

  getPublicConfig() {
    const safe = { ...this.config };
    // Mask password for security if present
    if (safe.smtpPass) {
      safe.hasPassword = true;
      safe.smtpPass = '••••••••';
    } else {
      safe.hasPassword = false;
    }
    return safe;
  }

  createTransporter(overrideConfig = null) {
    const c = overrideConfig || this.config;
    // If incoming pass is masked, reuse existing saved pass
    const pass = (overrideConfig && overrideConfig.smtpPass && overrideConfig.smtpPass !== '••••••••')
      ? overrideConfig.smtpPass
      : this.config.smtpPass;

    return nodemailer.createTransport({
      host: c.smtpHost,
      port: Number(c.smtpPort) || 587,
      secure: Boolean(c.smtpSecure),
      auth: {
        user: c.smtpUser,
        pass: pass
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false // Permissive for internal corporate SMTP relays and Office 365
      }
    });
  }

  async testConnection(testCfg = null) {
    try {
      const transporter = this.createTransporter(testCfg);
      await transporter.verify();
      return { success: true, message: 'SMTP connection verified successfully!' };
    } catch (err) {
      return { success: false, message: `SMTP verification failed: ${err.message}` };
    }
  }

  async sendReportNow({ recipients = null, days = null, isTest = false } = {}) {
    const targetRecipients = recipients || this.config.recipients;
    if (!targetRecipients) {
      throw new Error('No recipient email addresses specified');
    }

    const daysCount = days || (this.config.frequency === 'weekly' ? 7 : 1);
    const analytics = await reportService.getReportAnalytics({ days: daysCount });
    const htmlContent = await reportService.generateMonitoringHtml({ days: daysCount });

    const subject = isTest
      ? `[TEST REPORT] NetPulse Network Health & SLA Audit (${daysCount}d)`
      : `[${analytics.branding?.organizationName || 'NetPulse'}] Network Health & SLA Audit - ${new Date().toLocaleDateString()}`;

    const transporter = this.createTransporter();
    const fromAddress = `"${this.config.senderName || 'NetPulse NOC'}" <${this.config.senderEmail || this.config.smtpUser}>`;

    const mailOptions = {
      from: fromAddress,
      to: targetRecipients,
      subject: subject,
      html: htmlContent,
      text: `NetPulse Network Audit: Uptime ${analytics.metrics?.uptimePercent}% | SLA: ${analytics.compliance?.slaStatus} | Score: ${analytics.compliance?.healthScore}/100.`
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      this.config.lastSentAt = new Date().toISOString();
      this.config.lastStatus = 'SUCCESS';
      this.config.lastError = null;
      fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(this.config, null, 2));

      return {
        success: true,
        messageId: info.messageId,
        sentTo: targetRecipients,
        sentAt: this.config.lastSentAt
      };
    } catch (err) {
      this.config.lastStatus = 'ERROR';
      this.config.lastError = err.message;
      fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(this.config, null, 2));
      throw err;
    }
  }

  startScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    // Check every 60 seconds
    this.schedulerTimer = setInterval(() => this.checkSchedule(), 60000);
  }

  async checkSchedule() {
    if (!this.config.enabled || !this.config.recipients || !this.config.smtpUser) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 1 = Monday

    if (currentHour !== Number(this.config.scheduledHour)) {
      return;
    }

    // Check if already sent today
    if (this.config.lastSentAt) {
      const last = new Date(this.config.lastSentAt);
      const isSameDay = last.getFullYear() === now.getFullYear() &&
                        last.getMonth() === now.getMonth() &&
                        last.getDate() === now.getDate();
      if (isSameDay) return;
    }

    // If weekly, only send on Monday (day 1)
    if (this.config.frequency === 'weekly' && currentDay !== 1) {
      return;
    }

    console.log(`[EmailReportService] Auto-dispatching ${this.config.frequency} report to ${this.config.recipients}...`);
    try {
      await this.sendReportNow();
      console.log('[EmailReportService] Auto-dispatch completed successfully.');
    } catch (err) {
      console.error('[EmailReportService] Auto-dispatch failed:', err.message);
    }
  }
}

export default new EmailReportService();
