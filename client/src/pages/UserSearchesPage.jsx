import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Globe,
  Monitor,
  User,
  Users,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Sparkles,
  Youtube,
  AlertTriangle,
  ShieldAlert,
  Radio,
  Compass,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
  EyeOff,
  Terminal,
  X,
  Trash2,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  ListFilter,
  Briefcase,
  Film,
  Code2,
  ShoppingBag,
  MessageSquare,
  Sliders,
  Plus,
  Ban,
  Mail,
  Activity,
  Copy,
  Zap,
  Clock,
  Send
} from 'lucide-react';
import api from '../services/api';
import CustomEmailReportModal from '../components/reports/CustomEmailReportModal';

// Bulletproof Date / Time Helpers that never throw exceptions on null/invalid inputs
function safeFormatTime(isoString, opts = { hour: '2-digit', minute: '2-digit' }) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], opts);
  } catch (_) {
    return '—';
  }
}

function safeFormatDate(isoString, opts = { month: 'short', day: 'numeric' }) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString([], opts);
  } catch (_) {
    return '—';
  }
}

function safeFormatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch (_) {
    return '—';
  }
}

function safeInitial(val) {
  const str = String(val || '?').trim();
  return str.length > 0 ? str.slice(0, 1).toUpperCase() : '?';
}

// Safely extract numeric latency strings from endpointPing without ever rendering raw objects in React
function getSafePingValues(endpointPing) {
  if (!endpointPing || typeof endpointPing !== 'object') return null;

  const gLat =
    typeof endpointPing.googleLatencyMs === 'number'
      ? endpointPing.googleLatencyMs
      : typeof endpointPing.google?.latency === 'number'
      ? endpointPing.google.latency
      : typeof endpointPing.google === 'number'
      ? endpointPing.google
      : null;

  const cfLat =
    typeof endpointPing.cloudflareLatencyMs === 'number'
      ? endpointPing.cloudflareLatencyMs
      : typeof endpointPing.cloudflare?.latency === 'number'
      ? endpointPing.cloudflare.latency
      : typeof endpointPing.cloudflare === 'number'
      ? endpointPing.cloudflare
      : null;

  if (gLat === null && cfLat === null) return null;

  return {
    google: gLat !== null ? `${gLat}ms` : '—',
    cloudflare: cfLat !== null ? `${cfLat}ms` : '—',
    summary: gLat !== null ? `${gLat}ms` : `${cfLat}ms`
  };
}

// Comprehensive helper to parse rich endpoint continuous ping telemetry
function getEndpointPingDetails(endpointPing) {
  if (!endpointPing || typeof endpointPing !== 'object') return null;

  const extractLat = (val) => {
    if (typeof val === 'number') return val;
    if (val && typeof val === 'object' && typeof val.latency === 'number') return val.latency;
    if (val && typeof val === 'object' && typeof val.avg === 'number') return val.avg;
    return null;
  };

  const gLat = extractLat(endpointPing.googleLatencyMs ?? endpointPing.google);
  const cfLat = extractLat(endpointPing.cloudflareLatencyMs ?? endpointPing.cloudflare);

  const gObj = typeof endpointPing.google === 'object' ? endpointPing.google : {};
  const cfObj = typeof endpointPing.cloudflare === 'object' ? endpointPing.cloudflare : {};

  const qualityScore =
    typeof endpointPing.qualityScore === 'string'
      ? endpointPing.qualityScore
      : gLat !== null && gLat < 30
      ? 'Optimal (Grade A+)'
      : 'Good (Grade A)';

  const jitter =
    typeof endpointPing.jitter === 'number'
      ? endpointPing.jitter
      : typeof gObj.jitter === 'number'
      ? gObj.jitter
      : 0;

  const packetLoss =
    typeof endpointPing.packetLoss === 'number'
      ? endpointPing.packetLoss
      : typeof gObj.loss === 'number'
      ? gObj.loss
      : 0;

  const logFile =
    typeof endpointPing.logFile === 'string' && endpointPing.logFile.trim()
      ? endpointPing.logFile
      : '%LOCALAPPDATA%\\NetPulseAgent\\endpoint_ping_telemetry.log';

  let testedAtFormatted = null;
  if (endpointPing.testedAt) {
    testedAtFormatted = safeFormatTime(endpointPing.testedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  let samples = [];
  if (Array.isArray(endpointPing.recentSamples)) {
    samples = endpointPing.recentSamples;
  } else if (endpointPing.recentSamples && typeof endpointPing.recentSamples === 'object') {
    samples = [endpointPing.recentSamples];
  }

  return {
    hasData: gLat !== null || cfLat !== null,
    gLat: gLat !== null ? `${gLat} ms` : '—',
    gRaw: gLat,
    gMin: typeof gObj.min === 'number' ? `${gObj.min}ms` : null,
    gMax: typeof gObj.max === 'number' ? `${gObj.max}ms` : null,
    gLoss: typeof gObj.loss === 'number' ? `${gObj.loss}%` : '0%',
    gStatus: gObj.status || (gLat !== null ? 'UP' : 'UNKNOWN'),

    cfLat: cfLat !== null ? `${cfLat} ms` : '—',
    cfRaw: cfLat,
    cfMin: typeof cfObj.min === 'number' ? `${cfObj.min}ms` : null,
    cfMax: typeof cfObj.max === 'number' ? `${cfObj.max}ms` : null,
    cfLoss: typeof cfObj.loss === 'number' ? `${cfObj.loss}%` : '0%',
    cfStatus: cfObj.status || (cfLat !== null ? 'UP' : 'UNKNOWN'),

    jitter: `${jitter} ms`,
    jitterRaw: jitter,
    packetLoss: `${packetLoss}%`,
    packetLossRaw: packetLoss,
    qualityScore,
    logFile,
    testedAt: testedAtFormatted,
    samples,
    isOutage: packetLoss >= 50 || gObj.status === 'DOWN' || cfObj.status === 'DOWN',
    isDegraded: packetLoss > 0 && packetLoss < 50
  };
}

// Relative time helper for live Agent sync indicators
function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch (_) {
    return 'Recently';
  }
}

export default function UserSearchesPage({ devices = [] }) {
  const [dnsTraffic, setDnsTraffic] = useState([]);
  const [endpointTelemetry, setEndpointTelemetry] = useState({});
  const [loading, setLoading] = useState(true);
  const [isHarvestingDns, setIsHarvestingDns] = useState(false);

  // Navigation & Drill-Down State
  // selectedDeviceIp === null -> Clean Connected Devices Grid
  // selectedDeviceIp !== null -> Full Device Inspector (Profiles + Categories + Searches)
  const [selectedDeviceIp, setSelectedDeviceIp] = useState(null);
  const [viewMode, setViewMode] = useState('devices'); // 'devices' | 'global'
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('');

  // Filters inside Device Inspector (or Global View)
  const [selectedProfile, setSelectedProfile] = useState('ALL'); // 'ALL' | 'INCOGNITO' | specific profile label
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activitySubFilter, setActivitySubFilter] = useState('ALL');
  // 'ALL' | 'SEARCH' | 'RESTRICTED' | 'CRITICAL' | 'INCOGNITO' | 'WEB_VISIT'
  const [searchQueryText, setSearchQueryText] = useState('');

  // Custom Restricted & Critical Policy Rules Modal State
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [restrictedRules, setRestrictedRules] = useState([]);
  const [criticalRules, setCriticalRules] = useState([]);
  const [newRestrictedInput, setNewRestrictedInput] = useState('');
  const [newCriticalInput, setNewCriticalInput] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Deploy Client Agent Modal
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(
    `${window.location.protocol}//${window.location.hostname}:5000`
  );
  const [searchEmailToast, setSearchEmailToast] = useState(null);

  // Dedicated Custom Recipient Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalType, setEmailModalType] = useState('searches'); // 'searches' | 'ping'
  const [emailModalDeviceIp, setEmailModalDeviceIp] = useState(null);
  const [customRecipientInput, setCustomRecipientInput] = useState('');
  const [savedEmailRecipients, setSavedEmailRecipients] = useState([]);
  const [sendingCustomEmail, setSendingCustomEmail] = useState(false);

  const openEmailModal = async (type = 'searches', deviceIp = null) => {
    setEmailModalType(type);
    const targetIp = deviceIp || (activeDevice ? activeDevice.ip : selectedDeviceIp || (deviceDirectory[0]?.ip || null));
    setEmailModalDeviceIp(targetIp);
    setShowEmailModal(true);

    try {
      const cfg = await api.getEmailReportConfig().catch(() => null);
      if (cfg) {
        const list = Array.isArray(cfg.recipientList)
          ? cfg.recipientList.filter((r) => r.enabled !== false).map((r) => r.email)
          : [];
        if (cfg.recipients && typeof cfg.recipients === 'string') {
          const splitted = cfg.recipients.split(',').map((s) => s.trim()).filter(Boolean);
          list.push(...splitted);
        }
        const unique = Array.from(new Set(list.filter((e) => e && e.includes('@'))));
        setSavedEmailRecipients(unique);
        if (!customRecipientInput && unique.length > 0) {
          setCustomRecipientInput(unique[0]);
        }
      }
    } catch (_) {}
  };

  const handleSendCustomEmail = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const recipient = customRecipientInput.trim();
    if (!recipient) {
      alert('Please enter at least one recipient email address.');
      return;
    }

    setSendingCustomEmail(true);
    try {
      let res = null;
      const targetIp = emailModalDeviceIp || (activeDevice ? activeDevice.ip : selectedDeviceIp || undefined);
      if (emailModalType === 'ping') {
        res = await api.sendEndpointPingEmailReport({
          deviceIp: targetIp,
          recipients: recipient
        });
      } else {
        res = await api.sendUserSearchEmailReport({
          deviceIp: targetIp,
          recipients: recipient
        });
      }

      setShowEmailModal(false);
      const targetLabel = activeDevice
        ? `${activeDevice.deviceName} (${activeDevice.activeUser || activeDevice.ip})`
        : targetIp || 'Workstation';
      setSearchEmailToast(
        res?.message || `${emailModalType === 'ping' ? 'Continuous Ping' : 'User Searches'} Report for ${targetLabel} emailed exclusively to: ${recipient}`
      );
      setTimeout(() => setSearchEmailToast(null), 5000);
    } catch (err) {
      alert(`Email dispatch failed: ${err.message}`);
    } finally {
      setSendingCustomEmail(false);
    }
  };

  const handleDownloadPingReport = (format = 'pdf') => {
    try {
      const targetIp = activeDevice ? activeDevice.ip : selectedDeviceIp || (deviceDirectory[0]?.ip || '');
      const url = api.downloadEndpointPingReportUrl(targetIp, format);

      if (format === 'pdf' || format === 'html') {
        window.open(url, '_blank', 'noopener,noreferrer');
        const targetLabel = activeDevice
          ? `${activeDevice.deviceName} (${activeDevice.activeUser || activeDevice.ip})`
          : targetIp || 'Endpoint';
        setSearchEmailToast(
          `Ping & Outage PDF Report for ${targetLabel} opened — Save as PDF in the print dialog!`
        );
        setTimeout(() => setSearchEmailToast(null), 4000);
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `NetPulse_Ping_Report_${activeDevice?.deviceName || 'PC'}_${activeDevice?.activeUser || 'User'}_${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'log'}`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSearchEmailToast(
        `Continuous Ping & Outage Report (${format.toUpperCase()}) downloaded successfully!`
      );
      setTimeout(() => setSearchEmailToast(null), 4000);
    } catch (err) {
      alert(`Error downloading ping report: ${err.message}`);
    }
  };

  const fetchActivityData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [trafficRes, policyRes, telemetryRes] = await Promise.all([
        api.getDnsTraffic({ limit: 400 }).catch(() => ({ traffic: [] })),
        api.getSearchPolicy().catch(() => null),
        api.getEndpointTelemetry().catch(() => ({}))
      ]);
      if (trafficRes?.traffic) {
        setDnsTraffic(trafficRes.traffic);
      }
      if (telemetryRes && typeof telemetryRes === 'object') {
        setEndpointTelemetry(telemetryRes);
      }
      if (policyRes) {
        setRestrictedRules(policyRes.restrictedRules || []);
        setCriticalRules(policyRes.criticalRules || []);
        if (policyRes.serverUrl) {
          setServerUrlInput((prev) =>
            prev.includes('localhost') || prev.includes('127.0.0.1') ? policyRes.serverUrl : prev
          );
        }
      }
    } catch (err) {
      console.error('Error fetching user search activity:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityData(false);
    const timer = setInterval(() => {
      fetchActivityData(true);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut: Press Escape to return to device grid
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedDeviceIp && !showPolicyModal && !showAgentModal && !showEmailModal) {
        setSelectedDeviceIp(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDeviceIp, showPolicyModal, showAgentModal, showEmailModal]);

  const handleHarvestDns = async () => {
    setIsHarvestingDns(true);
    try {
      const res = await api.harvestDnsCache();
      const updated = res?.traffic || res?.recent;
      if (updated) {
        setDnsTraffic(updated);
      } else {
        await fetchActivityData(true);
      }
    } catch (err) {
      alert(`Error harvesting browser searches & web activity: ${err.message}`);
    } finally {
      setIsHarvestingDns(false);
    }
  };

  const handleClearDns = async () => {
    if (!window.confirm('Clear all captured user searches and web activity history?')) return;
    try {
      await api.clearDnsTraffic();
      setDnsTraffic([]);
    } catch (err) {
      alert(`Error clearing activity: ${err.message}`);
    }
  };

  // Policy Rules Handlers
  const handleAddRestrictedRule = (e) => {
    e.preventDefault();
    const val = newRestrictedInput.toLowerCase().trim();
    if (!val) return;
    if (!restrictedRules.includes(val)) {
      setRestrictedRules((prev) => [val, ...prev]);
    }
    setNewRestrictedInput('');
  };

  const handleRemoveRestrictedRule = (rule) => {
    setRestrictedRules((prev) => prev.filter((r) => r !== rule));
  };

  const handleAddCriticalRule = (e) => {
    e.preventDefault();
    const val = newCriticalInput.toLowerCase().trim();
    if (!val) return;
    if (!criticalRules.includes(val)) {
      setCriticalRules((prev) => [val, ...prev]);
    }
    setNewCriticalInput('');
  };

  const handleRemoveCriticalRule = (rule) => {
    setCriticalRules((prev) => prev.filter((r) => r !== rule));
  };

  const handleSavePolicyRules = async () => {
    setSavingPolicy(true);
    try {
      const res = await api.saveSearchPolicy({
        restrictedRules,
        criticalRules
      });
      if (res?.policy) {
        setRestrictedRules(res.policy.restrictedRules || []);
        setCriticalRules(res.policy.criticalRules || []);
      }
      if (res?.traffic) {
        setDnsTraffic(res.traffic);
      } else {
        await fetchActivityData(true);
      }
      setShowPolicyModal(false);
    } catch (err) {
      alert(`Failed to save policy rules: ${err.message}`);
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDownloadAgentBat = async () => {
    try {
      const cleanUrl = (serverUrlInput || 'http://localhost:5000').trim();
      const res = await api.getSearchAgentScript(cleanUrl);
      if (res && res.script) {
        const blob = new Blob([res.script], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || 'NetPulse_Client_Search_Agent.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert(`Failed to generate agent script: ${err.message}`);
    }
  };

  const handleExportCsv = (recordsToExport = dnsTraffic) => {
    if (!recordsToExport || recordsToExport.length === 0) {
      alert('No activity records to export.');
      return;
    }

    const headers = [
      'Timestamp',
      'Device IP',
      'Hostname',
      'Windows User',
      'Browser Profile Name',
      'Profile Email',
      'Incognito / Private',
      'Browser',
      'Activity Type',
      'Search Engine',
      'Exact Search Query',
      'Page Title',
      'Domain',
      'URL',
      'Category',
      'Status (SAFE / RESTRICTED / CRITICAL)',
      'Rule Match Reason'
    ];

    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = recordsToExport.map((item) => [
      item.timestamp || '',
      item.clientIp || '',
      item.hostname || '',
      item.winUser || '',
      item.profileName || item.username || '',
      item.profileEmail || '',
      item.isIncognito ? 'YES (Incognito/Private)' : 'NO',
      item.browser || '',
      item.queryType || '',
      item.searchEngine || '',
      item.searchQuery || '',
      item.pageTitle || '',
      item.domain || '',
      item.url || '',
      item.category || '',
      item.threatLevel === 'MALICIOUS'
        ? 'CRITICAL'
        : item.threatLevel === 'SUSPICIOUS'
          ? 'RESTRICTED'
          : 'SAFE',
      item.flagReason || ''
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r) => r.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NetPulse_User_Searches_${selectedDeviceIp || 'All_Devices'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Build Comprehensive Device Directory (Merges active Search/DNS Endpoints + Registered LAN Devices)
  const deviceDirectory = useMemo(() => {
    const map = new Map();

    // 1. Ingest all devices that have reported search/web activity
    dnsTraffic.forEach((rec) => {
      const ip = String(rec.clientIp || 'Local Machine').trim();
      const telem = endpointTelemetry[ip] || {};
      const matchedDev = devices.find((d) => String(d.ip).trim() === ip);
      const lastSyncTime = telem.lastSeen || matchedDev?.lastAgentSync || matchedDev?.endpointPing?.testedAt || rec.timestamp;

      if (!map.has(ip)) {
        map.set(ip, {
          ip,
          deviceName: telem.hostname || matchedDev?.name || rec.hostname || ip,
          hostname: telem.hostname || rec.hostname || matchedDev?.name || 'Workstation',
          deviceType: matchedDev?.type || 'Endpoint PC',
          status: matchedDev?.status || 'UP',
          activeUser: telem.activeUser || matchedDev?.activeUser || null,
          endpointPing: telem.pingHealth || matchedDev?.endpointPing || null,
          lastAgentSync: lastSyncTime,
          winUsers: new Set(),
          profiles: new Map(),
          browsers: new Set(),
          categories: {},
          totalEvents: 0,
          searchCount: 0,
          webVisitCount: 0,
          incognitoCount: 0,
          restrictedCount: 0,
          criticalCount: 0,
          latestTimestamp: rec.timestamp,
          records: []
        });
      }

      const dev = map.get(ip);
      dev.records.push(rec);
      dev.totalEvents += 1;

      if (rec.winUser) dev.winUsers.add(rec.winUser);
      if (rec.browser) dev.browsers.add(rec.browser);

      // Keep lastAgentSync updated if newer
      if (lastSyncTime && (!dev.lastAgentSync || new Date(lastSyncTime) > new Date(dev.lastAgentSync))) {
        dev.lastAgentSync = lastSyncTime;
      }
      if (telem.activeUser && !dev.activeUser) dev.activeUser = telem.activeUser;
      if (telem.hostname && (!dev.deviceName || dev.deviceName === ip)) {
        dev.deviceName = telem.hostname;
        dev.hostname = telem.hostname;
      }

      const isIncog =
        Boolean(rec.isIncognito) || (rec.browser || '').toLowerCase().includes('incognito');
      const hasSearch = Boolean(rec.searchQuery && String(rec.searchQuery).trim());
      const isCritical = rec.threatLevel === 'MALICIOUS' || rec.threatLevel === 'CRITICAL';
      const isRestricted = rec.threatLevel === 'SUSPICIOUS' || rec.threatLevel === 'RESTRICTED';

      if (hasSearch) {
        dev.searchCount += 1;
      } else if (rec.queryType === 'WEB_VISIT') {
        dev.webVisitCount += 1;
      }

      if (isIncog) dev.incognitoCount += 1;
      if (isRestricted) dev.restrictedCount += 1;
      if (isCritical) dev.criticalCount += 1;

      const cat = rec.category || 'General Web Traffic';
      dev.categories[cat] = (dev.categories[cat] || 0) + 1;

      // Track individual logged-in Browser Profiles on this device (shown only after clicking the device!)
      if (
        rec.username &&
        rec.browser !== 'DNS Cache' &&
        !rec.username.includes('(Incognito Mode)') &&
        !rec.username.includes('(Incognito / DNS)')
      ) {
        const pKey = rec.username;
        if (!dev.profiles.has(pKey)) {
          dev.profiles.set(pKey, {
            label: rec.username,
            name: rec.profileName || rec.username.split('(')[0].trim(),
            email: rec.profileEmail || '',
            winUser: rec.winUser || '',
            browser: (rec.browser || 'Browser').split('(')[0].trim(),
            total: 0,
            searches: 0,
            incognito: 0,
            restricted: 0,
            critical: 0
          });
        }
        const pObj = dev.profiles.get(pKey);
        pObj.total += 1;
        if (hasSearch) pObj.searches += 1;
        if (isIncog) pObj.incognito += 1;
        if (isRestricted) pObj.restricted += 1;
        if (isCritical) pObj.critical += 1;
      }

      if (new Date(rec.timestamp) > new Date(dev.latestTimestamp || 0)) {
        dev.latestTimestamp = rec.timestamp;
      }
    });

    // 2. Include registered local LAN devices from NetPulse so all devices are visible
    devices.forEach((d) => {
      const ip = String(d.ip || '').trim();
      if (!ip) return;
      const isLan =
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.') ||
        ip === '127.0.0.1' ||
        ip === 'localhost';
      if (!isLan) return;

      const telem = endpointTelemetry[ip] || {};
      const lastSync = telem.lastSeen || d.lastAgentSync || d.endpointPing?.testedAt || null;

      if (!map.has(ip)) {
        map.set(ip, {
          ip,
          deviceName: telem.hostname || d.name || ip,
          hostname: telem.hostname || d.name || 'LAN Device',
          deviceType: d.type || 'Network Host',
          status: d.status || 'UP',
          activeUser: telem.activeUser || d.activeUser || null,
          endpointPing: telem.pingHealth || d.endpointPing || null,
          lastAgentSync: lastSync,
          winUsers: new Set(),
          profiles: new Map(),
          browsers: new Set(),
          categories: {},
          totalEvents: 0,
          searchCount: 0,
          webVisitCount: 0,
          incognitoCount: 0,
          restrictedCount: 0,
          criticalCount: 0,
          latestTimestamp: null,
          records: []
        });
      } else {
        const existing = map.get(ip);
        if (telem.activeUser) existing.activeUser = telem.activeUser;
        else if (d.activeUser && !existing.activeUser) existing.activeUser = d.activeUser;

        if (telem.pingHealth) existing.endpointPing = telem.pingHealth;
        else if (d.endpointPing && !existing.endpointPing) existing.endpointPing = d.endpointPing;

        if (telem.hostname) {
          existing.deviceName = telem.hostname;
          existing.hostname = telem.hostname;
        } else if (d.name && (!existing.deviceName || existing.deviceName === ip)) {
          existing.deviceName = d.name;
        }

        if (lastSync && (!existing.lastAgentSync || new Date(lastSync) > new Date(existing.lastAgentSync))) {
          existing.lastAgentSync = lastSync;
        }
      }
    });

    return Array.from(map.values())
      .map((d) => ({
        ...d,
        winUsers: Array.from(d.winUsers),
        profiles: Array.from(d.profiles.values()).sort((a, b) => b.total - a.total),
        browsers: Array.from(d.browsers)
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }, [dnsTraffic, devices, endpointTelemetry]);

  // Filter devices in the directory based on deviceSearchTerm
  const filteredDeviceDirectory = useMemo(() => {
    const q = (deviceSearchTerm || '').toLowerCase().trim();
    if (!q) return deviceDirectory;
    return deviceDirectory.filter((dev) => {
      const matchName = String(dev.deviceName || '').toLowerCase().includes(q);
      const matchHost = String(dev.hostname || '').toLowerCase().includes(q);
      const matchIp = String(dev.ip || '').toLowerCase().includes(q);
      const matchActiveUser = String(dev.activeUser || '').toLowerCase().includes(q);
      const matchWinUsers = (dev.winUsers || []).some((u) => String(u || '').toLowerCase().includes(q));
      const matchType = String(dev.deviceType || '').toLowerCase().includes(q);
      return matchName || matchHost || matchIp || matchActiveUser || matchWinUsers || matchType;
    });
  }, [deviceDirectory, deviceSearchTerm]);

  // Overall KPIs across all devices
  const globalKpis = useMemo(() => {
    const totalEvents = dnsTraffic.length;
    const totalSearches = dnsTraffic.filter((t) =>
      Boolean(t.searchQuery && String(t.searchQuery).trim())
    ).length;
    const totalIncognito = dnsTraffic.filter(
      (t) => Boolean(t.isIncognito) || (t.browser || '').toLowerCase().includes('incognito')
    ).length;
    const totalRestricted = dnsTraffic.filter(
      (t) => t.threatLevel === 'SUSPICIOUS' || t.threatLevel === 'RESTRICTED'
    ).length;
    const totalCritical = dnsTraffic.filter(
      (t) => t.threatLevel === 'MALICIOUS' || t.threatLevel === 'CRITICAL'
    ).length;
    const activeDevicesWithData = deviceDirectory.filter((d) => d.totalEvents > 0).length;

    return {
      totalEvents,
      totalSearches,
      totalIncognito,
      totalRestricted,
      totalCritical,
      activeDevicesWithData,
      totalDevices: deviceDirectory.length
    };
  }, [dnsTraffic, deviceDirectory]);

  // Currently selected Device object when inside Drill-Down View
  const activeDevice = useMemo(() => {
    if (!selectedDeviceIp) return null;
    const found = deviceDirectory.find((d) => d.ip === selectedDeviceIp);
    if (!found) return null;
    return {
      ...found,
      winUsers: Array.isArray(found.winUsers) ? found.winUsers : [],
      profiles: Array.isArray(found.profiles) ? found.profiles : [],
      browsers: Array.isArray(found.browsers) ? found.browsers : [],
      records: Array.isArray(found.records) ? found.records : []
    };
  }, [selectedDeviceIp, deviceDirectory]);

  // Records to display in the active view (Device Drill-down OR Global Feed)
  const filteredRecords = useMemo(() => {
    const baseList = activeDevice && Array.isArray(activeDevice.records) ? activeDevice.records : (Array.isArray(dnsTraffic) ? dnsTraffic : []);
    const q = (searchQueryText || '').toLowerCase().trim();

    return baseList.filter((item) => {
      if (!item) return false;
      const isIncog =
        Boolean(item.isIncognito) || String(item.browser || '').toLowerCase().includes('incognito');
      const hasSearch = Boolean(item.searchQuery && String(item.searchQuery).trim());
      const isCritical = item.threatLevel === 'MALICIOUS' || item.threatLevel === 'CRITICAL';
      const isRestricted = item.threatLevel === 'SUSPICIOUS' || item.threatLevel === 'RESTRICTED';

      // Profile filter
      if (selectedProfile === 'INCOGNITO') {
        if (!isIncog) return false;
      } else if (selectedProfile !== 'ALL') {
        if (item.username !== selectedProfile) return false;
      }

      // Activity Type Sub-filter
      if (activitySubFilter === 'SEARCH' && !hasSearch) return false;
      if (activitySubFilter === 'INCOGNITO' && !isIncog) return false;
      if (activitySubFilter === 'RESTRICTED' && !isRestricted) return false;
      if (activitySubFilter === 'CRITICAL' && !isCritical) return false;
      if (activitySubFilter === 'WEB_VISIT' && (hasSearch || isIncog)) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // Search box filter with bulletproof String() conversion
      if (q) {
        const matchesText =
          (item.searchQuery && String(item.searchQuery).toLowerCase().includes(q)) ||
          (item.pageTitle && String(item.pageTitle).toLowerCase().includes(q)) ||
          (item.domain && String(item.domain).toLowerCase().includes(q)) ||
          (item.username && String(item.username).toLowerCase().includes(q)) ||
          (item.profileName && String(item.profileName).toLowerCase().includes(q)) ||
          (item.profileEmail && String(item.profileEmail).toLowerCase().includes(q)) ||
          (item.winUser && String(item.winUser).toLowerCase().includes(q)) ||
          (item.clientIp && String(item.clientIp).toLowerCase().includes(q)) ||
          (item.hostname && String(item.hostname).toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      return true;
    });
  }, [
    activeDevice,
    dnsTraffic,
    selectedProfile,
    activitySubFilter,
    selectedCategory,
    searchQueryText
  ]);

  // Category counts for the current context (selected device or global)
  const contextCategories = useMemo(() => {
    const baseList = activeDevice ? activeDevice.records : dnsTraffic;
    const counts = {};
    baseList.forEach((r) => {
      const c = r.category || 'General Web Traffic';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeDevice, dnsTraffic]);

  const handleOpenDevice = (ip) => {
    setSelectedDeviceIp(ip);
    setSelectedProfile('ALL');
    setSelectedCategory('ALL');
    setActivitySubFilter('ALL');
    setSearchQueryText('');
  };

  const renderCategoryIcon = (catName) => {
    const c = (catName || '').toLowerCase();
    if (c.includes('critical')) return <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />;
    if (c.includes('restricted')) return <Ban className="w-3.5 h-3.5 text-amber-500" />;
    if (c.includes('video') || c.includes('media')) return <Film className="w-3.5 h-3.5 text-rose-500" />;
    if (c.includes('work') || c.includes('enterprise')) return <Briefcase className="w-3.5 h-3.5 text-blue-500" />;
    if (c.includes('search')) return <Search className="w-3.5 h-3.5 text-cyan-500" />;
    if (c.includes('ai')) return <Sparkles className="w-3.5 h-3.5 text-purple-500" />;
    if (c.includes('dev') || c.includes('cloud')) return <Code2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (c.includes('shop')) return <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />;
    if (c.includes('social') || c.includes('chat')) return <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />;
    return <Globe className="w-3.5 h-3.5 text-slate-400" />;
  };

  const renderBrowserBadge = (item) => {
    const b = (item.browser || 'DNS').toLowerCase();
    const isIncog = Boolean(item.isIncognito) || b.includes('incognito');

    if (isIncog) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-[10px] font-bold">
          <EyeOff className="w-3 h-3 text-purple-500" />
          <span>{item.browser || 'Incognito / DNS'}</span>
        </span>
      );
    }
    if (b.includes('chrome')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Chrome
        </span>
      );
    }
    if (b.includes('edge')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Edge
        </span>
      );
    }
    if (b.includes('brave')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Brave
        </span>
      );
    }
    if (b.includes('firefox')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
          <Compass className="w-3 h-3" /> Firefox
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 text-[10px] font-mono">
        <Globe className="w-3 h-3" /> {item.browser || 'DNS'}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-full overflow-x-hidden pb-6">
      {searchEmailToast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{searchEmailToast}</span>
        </div>
      )}
      {/* TOP EXECUTIVE HEADER & GLOBAL KPIs (SHOWN IN DIRECTORY / GLOBAL VIEW ONLY) */}
      {!selectedDeviceIp && (
        <>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            {/* Row 1: Title & Subtitle on Left, Status Badges on Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0">
                  <Search className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    Connected Devices &amp; User Search Inspector
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any device card to inspect logged-in user profiles, exact searches, Incognito activity &amp; Restricted/Critical policy alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Search &amp; Policy Telemetry
                </span>
              </div>
            </div>

            {/* Row 2: Table-Wise Left-Aligned Action Buttons */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-start gap-2">
              <button
                onClick={() => setShowPolicyModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                title="Configure Restricted and Critical websites & search keywords"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Restricted &amp; Critical Rules</span>
              </button>

              <button
                onClick={() => setShowAgentModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Deploy 30-Min Agent</span>
              </button>

              <button
                onClick={handleHarvestDns}
                disabled={isHarvestingDns}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isHarvestingDns ? 'animate-spin' : ''}`} />
                <span>{isHarvestingDns ? 'Scanning...' : 'Harvest Live Searches'}</span>
              </button>

              <button
                onClick={() => handleDownloadPingReport('pdf')}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
                title="Download / Print Executive Endpoint WAN Ping & Outage Report as PDF"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Download Ping PDF</span>
              </button>

              <button
                onClick={() => openEmailModal('ping')}
                className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                title="Email Endpoint Continuous WAN Ping & Outage Report to Specific Recipient"
              >
                <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>Email Ping Report</span>
              </button>

              <button
                onClick={() => openEmailModal('searches')}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                title="Email User Search & Web Activity Report to Specific Recipient"
              >
                <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Email Search Report</span>
              </button>

              <button
                onClick={() => handleExportCsv(dnsTraffic)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                title="Export CSV Report"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* 5 EXECUTIVE KPI SUMMARY CARDS — AUTO-FIT RESPONSIVE GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <div
              onClick={() => {
                setSelectedDeviceIp(null);
                setViewMode('devices');
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-500/40 transition-all min-w-0"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Monitored Devices
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {globalKpis.totalDevices}
                  </span>
                  <span className="text-[11px] text-emerald-500 font-semibold whitespace-nowrap">
                    ({globalKpis.activeDevicesWithData} active)
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => {
                setViewMode('global');
                setActivitySubFilter('SEARCH');
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:border-cyan-500/40 transition-all min-w-0"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Exact Searches
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400">
                    {globalKpis.totalSearches}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Queries</span>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-500 shrink-0">
                <Search className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => {
                setViewMode('global');
                setActivitySubFilter('INCOGNITO');
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:border-purple-500/40 transition-all min-w-0"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Incognito / DNS
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
                    {globalKpis.totalIncognito}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Hidden</span>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-500 shrink-0">
                <EyeOff className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => {
                setViewMode('global');
                setActivitySubFilter('RESTRICTED');
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/25 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:border-amber-500 transition-all min-w-0"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block truncate">
                  Restricted Sites/Searches
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-amber-500">
                    {globalKpis.totalRestricted}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Policy Hits</span>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 shrink-0">
                <Ban className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => {
                setViewMode('global');
                setActivitySubFilter('CRITICAL');
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/25 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:border-rose-500 transition-all min-w-0 sm:col-span-2 md:col-span-1"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block truncate">
                  Critical Alerts
                </span>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-rose-500">
                    {globalKpis.totalCritical}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">High Risk</span>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW MODE SWITCHER & DEVICE SEARCH BAR (WHEN NOT INSIDE A SPECIFIC DEVICE) */}
      {!selectedDeviceIp && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          {/* Left: View Mode Toggles + Search Devices Input */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl shrink-0 border border-slate-200/60 dark:border-slate-700/60">
              <button
                onClick={() => {
                  setViewMode('devices');
                  setActivitySubFilter('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'devices'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0 text-cyan-500" />
                <span>Connected Devices ({deviceDirectory.length})</span>
              </button>

              <button
                onClick={() => setViewMode('global')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'global'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ListFilter className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>All Activity Stream ({dnsTraffic.length})</span>
              </button>
            </div>

            {/* Search Devices Input right after Connected Devices & All Activity Stream */}
            {viewMode === 'devices' && (
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search devices by name, IP, PC user..."
                  value={deviceSearchTerm}
                  onChange={(e) => setDeviceSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 shadow-2xs"
                />
                {deviceSearchTerm && (
                  <button
                    onClick={() => setDeviceSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded cursor-pointer"
                    title="Clear device search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Side: Results counter or Clear History */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {viewMode === 'devices' && deviceSearchTerm && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60">
                Found: <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{filteredDeviceDirectory.length}</strong> / {deviceDirectory.length}
              </span>
            )}

            {dnsTraffic.length > 0 && viewMode === 'global' && (
              <button
                onClick={handleClearDns}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 1: AUTO-RESPONSIVE CONNECTED DEVICES DIRECTORY GRID
          (Uses auto-fill minmax so cards never squish on any screen width!)
         ===================================================================== */}
      {!selectedDeviceIp && viewMode === 'devices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredDeviceDirectory.map((dev) => {
            const hasActivity = dev.totalEvents > 0;
            const mainTitle =
              (typeof dev.activeUser === 'string' && dev.activeUser.trim()) ||
              (dev.winUsers.length > 0 ? dev.winUsers.join(', ') : dev.deviceName);
            return (
              <div
                key={dev.ip}
                onClick={() => handleOpenDevice(dev.ip)}
                className={`group rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 min-w-0 ${
                  hasActivity
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 shadow-xs hover:shadow-lg hover:shadow-cyan-500/5'
                    : 'bg-white/60 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800/60 hover:border-slate-400'
                }`}
              >
                {/* Clean Device Header */}
                <div className="flex items-start justify-between gap-2.5 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                        hasActivity
                          ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-500'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate group-hover:text-cyan-500 transition-colors"
                          title={mainTitle}
                        >
                          {mainTitle}
                        </h3>
                        {typeof dev.activeUser === 'string' && dev.activeUser.trim() && (
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 shrink-0">
                            👤 {dev.activeUser}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs">
                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                          {dev.ip}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-full">
                          • Desktop:{' '}
                          <strong className="text-slate-600 dark:text-slate-300 font-semibold">
                            {dev.deviceName}
                          </strong>
                        </span>
                        {(() => {
                          const pingVals = getSafePingValues(dev.endpointPing);
                          if (!pingVals) return null;
                          return (
                            <span
                              className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20"
                              title={`WAN Ping: 8.8.8.8 (${pingVals.google}) | 1.1.1.1 (${pingVals.cloudflare})`}
                            >
                              ⚡ 8.8.8.8: {pingVals.google}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      hasActivity
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {hasActivity ? 'ACTIVE' : 'NO LOGS'}
                  </span>
                </div>

                {/* Responsive 5-Metric Summary Strip on Card */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800 min-w-0">
                    <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 leading-tight">
                      {dev.profiles.length}
                    </div>
                    <div className="text-[9px] font-bold uppercase text-slate-400 truncate mt-0.5">
                      Profiles
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800 min-w-0">
                    <div className="text-sm font-black text-cyan-600 dark:text-cyan-400 leading-tight">
                      {dev.searchCount}
                    </div>
                    <div className="text-[9px] font-bold uppercase text-slate-400 truncate mt-0.5">
                      Searches
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800 min-w-0">
                    <div className="text-sm font-black text-purple-600 dark:text-purple-400 leading-tight">
                      {dev.incognitoCount}
                    </div>
                    <div className="text-[9px] font-bold uppercase text-slate-400 truncate mt-0.5">
                      Incognito
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 min-w-0">
                    <div className="text-sm font-black text-amber-500 leading-tight">
                      {dev.restrictedCount}
                    </div>
                    <div className="text-[9px] font-bold uppercase text-amber-500/80 truncate mt-0.5">
                      Restricted
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-rose-500/5 border border-rose-500/20 min-w-0 col-span-2 sm:col-span-1">
                    <div className="text-sm font-black text-rose-500 leading-tight">
                      {dev.criticalCount}
                    </div>
                    <div className="text-[9px] font-bold uppercase text-rose-500/80 truncate mt-0.5">
                      Critical
                    </div>
                  </div>
                </div>

                {/* Clean Card Footer with Live Sync Info */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    {dev.lastAgentSync ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate"
                        title={`Agent Telemetry Push: ${safeFormatDateTime(dev.lastAgentSync)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-slate-400 font-normal">Sync:</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {safeFormatTime(dev.lastAgentSync)}
                        </strong>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">({formatRelativeTime(dev.lastAgentSync)})</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 truncate">
                        {dev.totalEvents} total web events
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                    <span>Click to Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {filteredDeviceDirectory.length === 0 && (
            <div className="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Search className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No matching devices found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No monitored device matched "{deviceSearchTerm}". Try searching with a different IP, Windows username, or PC hostname.
              </p>
              <button
                onClick={() => setDeviceSearchTerm('')}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Device Search</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 2: SELECTED DEVICE DRILL-DOWN INSPECTOR OR GLOBAL STREAM
          (Auto-responsive header, profile cards, filter bar, mobile cards & desktop table)
         ===================================================================== */}
      {(selectedDeviceIp || viewMode === 'global') && (
        <div className="space-y-4 animate-in fade-in duration-200 min-w-0">
          {/* DEDICATED DEVICE INSPECTOR VIEW (Shown after clicking "Click to Inspect") */}
          {activeDevice && (() => {
            const pingDetails = getEndpointPingDetails(activeDevice.endpointPing);
            const deviceDisplayName =
              (typeof activeDevice.activeUser === 'string' && activeDevice.activeUser.trim()) ||
              (activeDevice.winUsers.length > 0 ? activeDevice.winUsers.join(', ') : activeDevice.deviceName);

            return (
              <div className="space-y-4 min-w-0">
                {/* 1. DEDICATED DEVICE INSPECTOR BANNER (Exact Security Hub Header Style) */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  {/* Row 1: Title & Subtitle on Left, Status Badge on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedDeviceIp(null)}
                        className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 group"
                        title="Click to go Back to Devices Directory"
                      >
                        <Monitor className="w-5 h-5 stroke-[2.2] group-hover:hidden transition-all" />
                        <ArrowLeft className="w-5 h-5 stroke-[2.2] hidden group-hover:block transition-all" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate" title={deviceDisplayName}>
                            {deviceDisplayName}
                          </h1>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeDevice.ip);
                              setSearchEmailToast(`IP ${activeDevice.ip} copied to clipboard!`);
                              setTimeout(() => setSearchEmailToast(null), 3000);
                            }}
                            className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title="Click to copy IP"
                          >
                            <span>{activeDevice.ip}</span>
                            <Copy className="w-3 h-3 opacity-70" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>Host: <strong className="text-slate-700 dark:text-slate-200">{activeDevice.deviceName}</strong></span>
                          {typeof activeDevice.activeUser === 'string' && activeDevice.activeUser.trim() && (
                            <>
                              <span className="opacity-40">•</span>
                              <span>User: <strong className="text-indigo-600 dark:text-indigo-400">{activeDevice.activeUser}</strong></span>
                            </>
                          )}
                          <span className="opacity-40">•</span>
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Clock className="w-3 h-3" />
                            <span>Synced {safeFormatTime(activeDevice.lastAgentSync)} ({formatRelativeTime(activeDevice.lastAgentSync)})</span>
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
                        <Radio className="w-3 h-3 animate-pulse" />
                        Endpoint Telemetry Active
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Table-Wise Left-Aligned Action Buttons (All on Left) */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDeviceIp(null)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      title="Return to Connected Devices Directory (Esc)"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>Back to Devices</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPingReport('pdf')}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
                      title="Download WAN Ping & Outage Report as PDF"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Download Ping Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEmailModal('ping', activeDevice.ip)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                      title="Email Ping Report to specific recipient"
                    >
                      <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>Email Ping</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportCsv(activeDevice.records)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap"
                      title="Export Searches & Web Activity to CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                      <span>Export Searches CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEmailModal('searches', activeDevice.ip)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                      title="Email User Searches & Web Activity to specific recipient"
                    >
                      <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Email Searches</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPolicyModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
                      title="Configure Restricted & Critical Policy Rules"
                    >
                      <Sliders className="w-3.5 h-3.5 shrink-0" />
                      <span>Policy Rules</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAgentModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                      title="Download 1-Click Monitoring Agent (.bat)"
                    >
                      <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>Agent (.bat)</span>
                    </button>
                  </div>
                </div>

                {/* 2. UNIFIED 6-CARD DEVICE TELEMETRY & ACTIVITY KPI GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {/* Card 1: Google DNS 8.8.8.8 */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-1 truncate">
                        <Globe className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>8.8.8.8 Ping</span>
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                          pingDetails?.gStatus === 'UP'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-500/15 text-slate-400'
                        }`}
                      >
                        {pingDetails?.gStatus || 'IDLE'}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                      {pingDetails?.gLat || '—'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {pingDetails?.gMin ? `Min ${pingDetails.gMin} / Max ${pingDetails.gMax}` : 'Google Anycast DNS'}
                    </div>
                  </div>

                  {/* Card 2: Cloudflare 1.1.1.1 */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-1 truncate">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>1.1.1.1 Ping</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-500">
                        {pingDetails?.packetLoss || '0%'} loss
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                      {pingDetails?.cfLat || '—'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {pingDetails?.hasData ? `Jitter: ±${pingDetails.jitter}` : 'Cloudflare DNS'}
                    </div>
                  </div>

                  {/* Card 3: Exact Searches */}
                  <button
                    onClick={() => setActivitySubFilter(activitySubFilter === 'SEARCH' ? 'ALL' : 'SEARCH')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      activitySubFilter === 'SEARCH'
                        ? 'bg-cyan-500 text-white border-cyan-500 shadow-md'
                        : 'bg-white dark:bg-[#0b1220] border-slate-200 dark:border-[#1c2940] hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-80">
                      <span>Searches</span>
                      <Search className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${activitySubFilter === 'SEARCH' ? 'text-white' : 'text-cyan-600 dark:text-cyan-400'}`}>
                      {activeDevice.searchCount}
                    </div>
                    <div className="text-[10px] opacity-75 truncate">
                      {activeDevice.totalEvents} total events
                    </div>
                  </button>

                  {/* Card 4: Incognito / Private */}
                  <button
                    onClick={() => setActivitySubFilter(activitySubFilter === 'INCOGNITO' ? 'ALL' : 'INCOGNITO')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      activitySubFilter === 'INCOGNITO'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                        : 'bg-white dark:bg-[#0b1220] border-slate-200 dark:border-[#1c2940] hover:border-purple-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-80">
                      <span>Incognito</span>
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${activitySubFilter === 'INCOGNITO' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                      {activeDevice.incognitoCount}
                    </div>
                    <div className="text-[10px] opacity-75 truncate">Private / DNS logs</div>
                  </button>

                  {/* Card 5: Restricted Policy */}
                  <button
                    onClick={() => setActivitySubFilter(activitySubFilter === 'RESTRICTED' ? 'ALL' : 'RESTRICTED')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      activitySubFilter === 'RESTRICTED'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                        : 'bg-white dark:bg-[#0b1220] border-slate-200 dark:border-[#1c2940] hover:border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-80">
                      <span>Restricted</span>
                      <Ban className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${activitySubFilter === 'RESTRICTED' ? 'text-white' : 'text-amber-500'}`}>
                      {activeDevice.restrictedCount}
                    </div>
                    <div className="text-[10px] opacity-75 truncate">Policy warnings</div>
                  </button>

                  {/* Card 6: Critical Alerts */}
                  <button
                    onClick={() => setActivitySubFilter(activitySubFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      activitySubFilter === 'CRITICAL'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                        : 'bg-white dark:bg-[#0b1220] border-slate-200 dark:border-[#1c2940] hover:border-rose-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-80">
                      <span>Critical</span>
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${activitySubFilter === 'CRITICAL' ? 'text-white' : 'text-rose-500'}`}>
                      {activeDevice.criticalCount}
                    </div>
                    <div className="text-[10px] opacity-75 truncate">High-risk hits</div>
                  </button>
                </div>

                {/* 3. COMPACT CONTINUOUS WAN HEALTH & PING SAMPLES TIMELINE STRIP */}
                {pingDetails?.hasData && (
                  <div className="p-3 sm:px-4 rounded-2xl bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 shrink-0">
                      {pingDetails.isOutage ? (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : pingDetails.isDegraded ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {pingDetails.isOutage
                          ? 'Internet Outage Detected on PC'
                          : pingDetails.isDegraded
                            ? 'Degraded WAN Connection (Packet Loss)'
                            : '100% Continuous WAN Uptime'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {pingDetails.qualityScore}
                      </span>
                    </div>

                    {pingDetails.samples && pingDetails.samples.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 py-0.5 min-w-0 lg:justify-end">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                          Recent Probes:
                        </span>
                        {pingDetails.samples.slice(-8).map((sample, idx) => {
                          if (!sample || typeof sample !== 'object') return null;
                          const sampleLoss = Number(sample.loss || 0);
                          return (
                            <div
                              key={idx}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 shrink-0 ${
                                sampleLoss >= 50
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                                  : sampleLoss > 0
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span className="text-slate-400">{sample.time || `#${idx + 1}`}</span>
                              <span className="text-sky-600 dark:text-sky-400 font-bold">
                                {sample.google ?? '—'}ms
                              </span>
                              <span className="opacity-30">/</span>
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                {sample.cloudflare ?? '—'}ms
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. LOGGED-IN BROWSER PROFILES & CATEGORY PILLS CARD */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] shadow-2xs space-y-4">
                  {/* Browser Profiles Selector */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Browser Profiles on {activeDevice.deviceName} ({activeDevice.profiles.length})</span>
                      </span>
                      {selectedProfile !== 'ALL' && (
                        <button
                          onClick={() => setSelectedProfile('ALL')}
                          className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          Show All Profiles
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                      {/* All Profiles Combined Card */}
                      <button
                        onClick={() => setSelectedProfile('ALL')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-w-0 flex items-center gap-2.5 ${
                          selectedProfile === 'ALL'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                            : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black truncate">All Profiles</div>
                          <div className="text-[10px] opacity-75 truncate">
                            {activeDevice.totalEvents} logs • {activeDevice.searchCount} searches
                          </div>
                        </div>
                      </button>

                      {/* Individual Browser Profile Cards */}
                      {activeDevice.profiles.map((prof) => {
                        const isSelected = selectedProfile === prof.label;
                        return (
                          <button
                            key={prof.label}
                            onClick={() => setSelectedProfile(isSelected ? 'ALL' : prof.label)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-w-0 space-y-1.5 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                              <span className="text-xs font-bold truncate flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                                  }`}
                                >
                                  {safeInitial(prof.name)}
                                </span>
                                <span className="truncate font-extrabold" title={prof.name}>
                                  {prof.name}
                                </span>
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {prof.browser}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                              <span className={isSelected ? 'text-indigo-100 font-semibold' : 'text-cyan-600 dark:text-cyan-400 font-semibold'}>
                                {prof.searches} searches
                              </span>
                              <span className="opacity-40">•</span>
                              <span className="opacity-75">{prof.total} visits</span>
                              {prof.restricted > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                                  {prof.restricted} restricted
                                </span>
                              )}
                              {prof.critical > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold">
                                  {prof.critical} critical
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* Incognito Profile Card */}
                      {activeDevice.incognitoCount > 0 && (
                        <button
                          onClick={() => setSelectedProfile(selectedProfile === 'INCOGNITO' ? 'ALL' : 'INCOGNITO')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-w-0 flex items-center gap-2.5 ${
                            selectedProfile === 'INCOGNITO'
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-purple-500/5 text-purple-600 dark:text-purple-300 border-purple-500/25 hover:border-purple-500/50'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                            <EyeOff className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black truncate">Incognito / DNS</div>
                            <div className="text-[10px] opacity-80 truncate">
                              {activeDevice.incognitoCount} private sessions
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  {contextCategories.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                        Category:
                      </span>
                      <button
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          selectedCategory === 'ALL'
                            ? 'bg-cyan-500 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        All ({activeDevice.totalEvents})
                      </button>
                      {contextCategories.map((cat) => (
                        <button
                          key={cat.name}
                          onClick={() => setSelectedCategory(selectedCategory === cat.name ? 'ALL' : cat.name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                            selectedCategory === cat.name
                              ? 'bg-cyan-500 text-white border-cyan-500 shadow-2xs'
                              : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-500/40'
                          }`}
                        >
                          {renderCategoryIcon(cat.name)}
                          <span>{cat.name}</span>
                          <span className="text-[10px] font-mono opacity-75">({cat.count})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Fallback Transition Header if Selected Device is syncing */}
          {selectedDeviceIp && !activeDevice && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedDeviceIp(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Devices</span>
                </button>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Synchronizing device telemetry for <code className="font-mono text-cyan-600 dark:text-cyan-400">{selectedDeviceIp}</code>...
                  </div>
                  <div className="text-[11px] text-slate-400">Please wait or click Back to Devices</div>
                </div>
              </div>
            </div>
          )}

          {/* FILTER & SEARCH CONTROLS BAR — AUTO RESPONSIVE */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-[#101a2e] p-1.5 rounded-xl border border-transparent dark:border-[#1c2940]/60">
              <button
                onClick={() => setActivitySubFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  activitySubFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({filteredRecords.length})
              </button>
              <button
                onClick={() => setActivitySubFilter('SEARCH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  activitySubFilter === 'SEARCH'
                    ? 'bg-cyan-500 text-white shadow-2xs'
                    : 'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10'
                }`}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>Searches Only</span>
              </button>
              <button
                onClick={() => setActivitySubFilter('RESTRICTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  activitySubFilter === 'RESTRICTED'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <Ban className="w-3.5 h-3.5 shrink-0" />
                <span>Restricted</span>
              </button>
              <button
                onClick={() => setActivitySubFilter('CRITICAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  activitySubFilter === 'CRITICAL'
                    ? 'bg-rose-500 text-white shadow-2xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Critical</span>
              </button>
              <button
                onClick={() => setActivitySubFilter('INCOGNITO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  activitySubFilter === 'INCOGNITO'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                <span>Incognito</span>
              </button>
              <button
                onClick={() => setActivitySubFilter('WEB_VISIT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  activitySubFilter === 'WEB_VISIT'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Websites
              </button>
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-full md:max-w-xs lg:max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search keyword, YouTube title, website, or profile..."
                value={searchQueryText}
                onChange={(e) => setSearchQueryText(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              {searchQueryText && (
                <button
                  onClick={() => setSearchQueryText('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* =================================================================
              RESPONSIVE ACTIVITY FEED:
              - Mobile / Narrow Screens (< sm): Clean Touch-Friendly Stacked Cards
              - Tablet / Laptop / Desktop (>= sm): Fluid Auto-Fitting Responsive Table
             ================================================================= */}

          {/* 1. MOBILE / SMALL SCREEN STACKED CARDS (< sm) */}
          <div className="md:hidden space-y-3">
            {filteredRecords.map((item) => {
              const isCritical =
                item.threatLevel === 'MALICIOUS' || item.threatLevel === 'CRITICAL';
              const isRestricted =
                item.threatLevel === 'SUSPICIOUS' || item.threatLevel === 'RESTRICTED';
              const hasSearch = Boolean(item.searchQuery && String(item.searchQuery).trim());
              const isIncog =
                Boolean(item.isIncognito) ||
                (item.browser || '').toLowerCase().includes('incognito');
              const displayProfileName =
                item.profileName ||
                (item.username ? item.username.split('(')[0].trim() : 'User');

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border space-y-2.5 text-xs shadow-2xs transition-all ${
                    isCritical
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : isRestricted
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-white dark:bg-[#0b1220] border-slate-200 dark:border-[#1c2940]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isIncog
                            ? 'bg-purple-500/20 text-purple-500'
                            : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {isIncog ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          safeInitial(displayProfileName)
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 dark:text-white truncate">
                          {displayProfileName}
                        </div>
                        {item.profileEmail && (
                          <div className="text-[10px] font-mono text-indigo-500 truncate">
                            {item.profileEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                        isCritical
                          ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          : isRestricted
                            ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {isCritical ? 'CRITICAL' : isRestricted ? 'RESTRICTED' : 'SAFE'}
                    </span>
                  </div>

                  {/* Search Query or Website */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    {hasSearch ? (
                      <>
                        <div className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400">
                          {item.searchEngine || 'Search Query'}
                        </div>
                        <div className="font-black text-slate-900 dark:text-white break-words">
                          "{item.searchQuery}"
                        </div>
                      </>
                    ) : (
                      <div className="font-semibold text-slate-900 dark:text-white break-words">
                        {item.pageTitle && item.pageTitle !== item.domain
                          ? item.pageTitle
                          : item.domain}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-0.5">
                      <span className="truncate">{item.domain}</span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-cyan-500 hover:underline shrink-0"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {renderBrowserBadge(item)}
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        {item.category}
                      </span>
                    </div>
                    <span className="font-mono">
                      {safeFormatTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredRecords.length === 0 && (
              <div className="p-10 rounded-2xl bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-[#1c2940] text-center text-slate-400 text-xs">
                No records matching the selected filter.
              </div>
            )}
          </div>

          {/* 2. LAPTOP & DESKTOP 100% FIT TABLE — ZERO HORIZONTAL SCROLL (table-fixed) */}
          <div className="hidden md:block rounded-2xl overflow-hidden border border-slate-200 dark:border-[#1c2940] bg-white dark:bg-[#0b1220] shadow-sm w-full">
            <table className="w-full table-fixed text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1c2940] bg-slate-50/90 dark:bg-[#101a2e] text-[10px] lg:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-2.5 lg:px-3.5 w-[10%]">Time</th>
                  <th className="py-3 px-2.5 lg:px-3.5 w-[21%]">User Profile &amp; PC</th>
                  <th className="py-3 px-2 lg:px-3 w-[12%]">Browser</th>
                  <th className="py-3 px-2.5 lg:px-3.5 w-[33%]">Search Query / Website Activity</th>
                  <th className="py-3 px-2 lg:px-3 w-[13%]">Category</th>
                  <th className="py-3 px-2.5 lg:px-3.5 w-[11%] text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1c2940] text-xs">
                {filteredRecords.map((item) => {
                  const isCritical =
                    item.threatLevel === 'MALICIOUS' || item.threatLevel === 'CRITICAL';
                  const isRestricted =
                    item.threatLevel === 'SUSPICIOUS' || item.threatLevel === 'RESTRICTED';
                  const hasSearch = Boolean(
                    item.searchQuery && String(item.searchQuery).trim()
                  );
                  const isIncog =
                    Boolean(item.isIncognito) ||
                    (item.browser || '').toLowerCase().includes('incognito');

                  const displayProfileName =
                    item.profileName ||
                    (item.username ? item.username.split('(')[0].trim() : 'User');

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isCritical
                          ? 'bg-rose-500/10 hover:bg-rose-500/15'
                          : isRestricted
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : isIncog
                              ? 'bg-purple-500/[0.04] hover:bg-purple-500/[0.08]'
                              : hasSearch
                                ? 'bg-cyan-500/[0.03] hover:bg-cyan-500/[0.07]'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* 1. Time (10%) */}
                      <td className="py-3 px-2.5 lg:px-3.5 font-mono text-slate-400 text-[11px] align-top overflow-hidden">
                        <div className="font-bold text-slate-700 dark:text-slate-300 truncate">
                          {safeFormatTime(item.timestamp)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {safeFormatDate(item.timestamp)}
                        </div>
                      </td>

                      {/* 2. User Profile & PC (21%) */}
                      <td className="py-3 px-2.5 lg:px-3.5 align-top overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                              isIncog
                                ? 'bg-purple-500/20 text-purple-500'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            {isIncog ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              safeInitial(displayProfileName)
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className="font-extrabold text-slate-900 dark:text-white leading-tight truncate"
                              title={displayProfileName}
                            >
                              {displayProfileName}
                            </div>
                            {item.profileEmail && (
                              <div
                                className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 truncate"
                                title={item.profileEmail}
                              >
                                {item.profileEmail}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1 flex-wrap text-[10px] font-mono text-slate-400 min-w-0">
                          {item.winUser && (
                            <>
                              <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                                {item.winUser}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span className="truncate">{item.clientIp}</span>
                        </div>
                      </td>

                      {/* 3. Browser / Mode (12%) */}
                      <td className="py-3 px-2 lg:px-3 align-top overflow-hidden">
                        <div className="truncate">{renderBrowserBadge(item)}</div>
                      </td>

                      {/* 4. User Search Query / Website Activity (33%) */}
                      <td className="py-3 px-2.5 lg:px-3.5 align-top overflow-hidden">
                        {hasSearch ? (
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-start gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1 shrink-0">
                                {item.searchEngine?.toLowerCase().includes('youtube') ? (
                                  <Youtube className="w-3 h-3 text-rose-500 shrink-0" />
                                ) : item.searchEngine?.toLowerCase().includes('ai') ? (
                                  <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                                ) : (
                                  <Search className="w-3 h-3 text-cyan-500 shrink-0" />
                                )}
                                <span className="truncate max-w-[90px]">{item.searchEngine || 'Search'}</span>
                              </span>
                              <span className="font-black text-slate-900 dark:text-white text-xs bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/25 break-words min-w-0">
                                "{item.searchQuery}"
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono min-w-0">
                              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate" title={item.domain}>
                                {item.domain}
                              </span>
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-0.5 text-cyan-500 hover:underline shrink-0 font-sans"
                                >
                                  <span>Open</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 min-w-0">
                            <div
                              className="font-semibold text-slate-900 dark:text-white truncate"
                              title={item.pageTitle || item.domain}
                            >
                              {item.pageTitle && item.pageTitle !== item.domain
                                ? item.pageTitle
                                : item.domain}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 min-w-0">
                              <span className="truncate" title={item.domain}>{item.domain}</span>
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-0.5 text-cyan-500 hover:underline shrink-0 font-sans"
                                >
                                  <span>Visit</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 5. Category (13%) */}
                      <td className="py-3 px-2 lg:px-3 align-top overflow-hidden">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold max-w-full"
                          title={item.category}
                        >
                          <span className="shrink-0">{renderCategoryIcon(item.category)}</span>
                          <span className="truncate">{item.category}</span>
                        </span>
                      </td>

                      {/* 6. Policy Status (11%) */}
                      <td className="py-3 px-2.5 lg:px-3.5 align-top text-right overflow-hidden">
                        <div className="flex flex-col items-end gap-1 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                              isCritical
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : isRestricted
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isCritical ? (
                              <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                            ) : isRestricted ? (
                              <Ban className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            )}
                            <span>{isCritical ? 'CRITICAL' : isRestricted ? 'RESTRICTED' : 'SAFE'}</span>
                          </span>
                          {(isCritical || isRestricted) && item.flagReason && (
                            <div
                              className="text-[10px] text-slate-400 font-mono truncate max-w-full text-right"
                              title={item.flagReason}
                            >
                              {item.flagReason}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-14 text-center text-slate-400 text-xs">
                      No records matching the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Results Counter & Quick Reset Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredRecords.length}</strong> activity logs
              {activeDevice ? ` on ${activeDevice.deviceName}` : ' across network'}
            </span>
            {(searchQueryText || activitySubFilter !== 'ALL' || selectedCategory !== 'ALL' || selectedProfile !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQueryText('');
                  setActivitySubFilter('ALL');
                  setSelectedCategory('ALL');
                  setSelectedProfile('ALL');
                }}
                className="self-start sm:self-auto text-cyan-600 dark:text-cyan-400 hover:underline font-bold text-xs cursor-pointer flex items-center gap-1"
              >
                <span>Reset All Filters</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: RESTRICTED & CRITICAL WEBSITES / KEYWORDS POLICY SETTINGS
         ===================================================================== */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Restricted & Critical Websites / Keywords Settings
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Add website domains or search words to automatically flag them as Restricted or Critical
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto text-xs flex-1">
              {/* Section 1: Restricted Websites & Keywords */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-amber-500" />
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      Restricted Websites & Search Keywords ({restrictedRules.length})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase">
                    Shows in Restricted
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Agar koi user in websites ko khole ya yeh lafz search kare (e.g. <code>netflix.com</code>, <code>tiktok.com</code>, <code>olx.com.pk</code>, <code>movies</code>, <code>vpn</code>), to woh <strong>RESTRICTED</strong> me count aur highlight hoga.
                </p>

                <form onSubmit={handleAddRestrictedRule} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={newRestrictedInput}
                    onChange={(e) => setNewRestrictedInput(e.target.value)}
                    placeholder="Enter website or keyword (e.g. facebook.com, daraz.pk, gaming)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Restricted</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
                  {restrictedRules.map((rule) => (
                    <span
                      key={rule}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-500/30 text-slate-800 dark:text-slate-200 font-mono text-[11px]"
                    >
                      <span>{rule}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRestrictedRule(rule)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Section 2: Critical Websites & Keywords */}
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      Critical / High-Risk Websites & Keywords ({criticalRules.length})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase">
                    Shows in Critical
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Agar koi user high-risk cheez search kare ya open kare (e.g. <code>hack</code>, <code>crack</code>, <code>keygen</code>, <code>bypass firewall</code>, <code>darkweb</code>, <code>bet365</code>), to woh foran <strong>CRITICAL</strong> me show hoga.
                </p>

                <form onSubmit={handleAddCriticalRule} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={newCriticalInput}
                    onChange={(e) => setNewCriticalInput(e.target.value)}
                    placeholder="Enter critical website or keyword (e.g. crack, keygen, piratebay)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Critical</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
                  {criticalRules.map((rule) => (
                    <span
                      key={rule}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-rose-500/30 text-slate-800 dark:text-slate-200 font-mono text-[11px]"
                    >
                      <span>{rule}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCriticalRule(rule)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50 dark:bg-slate-900">
              <button
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePolicyRules}
                disabled={savingPolicy}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {savingPolicy ? 'Applying Rules...' : 'Save & Apply Rules Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: DEPLOY 30-MIN AUTO-SCHEDULED MULTI-USER AGENT
         ===================================================================== */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-slate-900 dark:to-indigo-950 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Deploy 30-Min Auto-Scheduled Search Agent (.bat)
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Captures all Windows Users, Browser Profile Names, Searches & Incognito DNS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                <div className="font-bold text-indigo-600 dark:text-indigo-400">
                  1-Click Setup (Run Once on Any Connected Office PC):
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Auto Task Scheduler (Every 30 Mins):</strong> Khud ko Windows Task
                    Scheduler me register karta hai aur har 30 minute baad background me silent sync
                    karta hai.
                  </li>
                  <li>
                    <strong>Real Profile Name & Multi-User:</strong> PC par jitne bhi Windows Users
                    (`C:\Users\*`) ya Browser Profiles login hon, unka asli Naam + Email aur searches
                    bhejta hai.
                  </li>
                  <li>
                    <strong>Incognito / Private Detection:</strong> Incognito window titles, Network
                    Isolation Keys, aur DNS resolver se private browsing domains bhi capture karta hai.
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  NetPulse Server IP / URL:
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://172.18.1.11:5000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadAgentBat}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-600 hover:from-indigo-600 hover:to-cyan-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download 1-Click Installer (.bat)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. UNIVERSAL CUSTOM RECIPIENT EMAIL DISPATCH MODAL (Ping or Search Report) */}
      <CustomEmailReportModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        reportTitle={
          emailModalType === 'ping'
            ? 'Email Endpoint Continuous Ping Report'
            : 'Email User Searches & Policy Audit Report'
        }
        reportSubtitle="Direct & exclusive delivery to custom recipient"
        reportScope={
          activeDevice
            ? `${activeDevice.deviceName} (${activeDevice.activeUser || activeDevice.ip})`
            : emailModalDeviceIp
              ? `Endpoint IP: ${emailModalDeviceIp}`
              : 'All Connected Endpoints (Global Fleet)'
        }
        scopeBadge={emailModalType === 'ping' ? 'WAN 8.8.8.8 Ping' : 'Individual Searches'}
        gradient={
          emailModalType === 'ping'
            ? 'from-sky-500 to-indigo-600'
            : 'from-emerald-500 to-teal-600'
        }
        onSend={async (recipients) => {
          const targetIp = emailModalDeviceIp || (activeDevice ? activeDevice.ip : selectedDeviceIp || undefined);
          if (emailModalType === 'ping') {
            return await api.sendEndpointPingEmailReport({
              deviceIp: targetIp,
              recipients
            });
          } else {
            return await api.sendUserSearchEmailReport({
              deviceIp: targetIp,
              recipients
            });
          }
        }}
        onSuccess={(res, rec) => {
          const targetLabel = activeDevice
            ? `${activeDevice.deviceName} (${activeDevice.activeUser || activeDevice.ip})`
            : emailModalDeviceIp || 'Workstation';
          setSearchEmailToast(
            res?.message || `${emailModalType === 'ping' ? 'Continuous Ping' : 'User Searches'} Report for ${targetLabel} emailed exclusively to: ${rec}`
          );
          setTimeout(() => setSearchEmailToast(null), 5000);
        }}
      />
    </div>
  );
}
