import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Unlock,
  Radar,
  RefreshCw,
  Server,
  Zap,
  Radio,
  FileCode,
  Crosshair,
  UserCheck,
  Globe,
  Network
} from 'lucide-react';
import api from '../services/api';

// Sub-Tab Components
import AttackSurfaceTab from '../components/security/AttackSurfaceTab';
import ArpGuardTab from '../components/security/ArpGuardTab';
import HoneypotSensorTab from '../components/security/HoneypotSensorTab';
import RogueAssetGuardTab from '../components/security/RogueAssetGuardTab';
import DnsTrafficTab from '../components/security/DnsTrafficTab';
import ThreatAlertsTab from '../components/security/ThreatAlertsTab';
import PortCatalogTab from '../components/security/PortCatalogTab';

// Modal Components
import VulnerabilityModal from '../components/security/VulnerabilityModal';
import RemediationModal from '../components/security/RemediationModal';
import AttackerBanModal from '../components/security/AttackerBanModal';

export const isLocalIp = (ipStr) => {
  if (!ipStr) return false;
  const clean = String(ipStr).split(':')[0].trim().toLowerCase();
  if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') return true;
  if (clean.startsWith('192.168.') || clean.startsWith('10.')) return true;
  if (clean.startsWith('172.')) {
    const parts = clean.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    }
  }
  return false;
};

// Circular Cyber Score Gauge
function CyberScoreGauge({ score = 100 }) {
  const radius = 32;
  const stroke = 5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const color =
    score >= 85
      ? '#10b981' // emerald
      : score >= 70
        ? '#f59e0b' // amber
        : '#f43f5e'; // rose

  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-800"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg sm:text-xl font-black tracking-tight" style={{ color }}>
          {score}
        </span>
        <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 -mt-0.5">/100</span>
      </div>
    </div>
  );
}

export default function SecurityHubPage({ devices = [] }) {
  // Main sub-tab state inside Security Hub
  const [activeSubTab, setActiveSubTab] = useState('attack-surface');
  // 'attack-surface' | 'arp-guard' | 'honeypot' | 'rogue-guard' | 'dns-traffic' | 'threat-alerts' | 'port-catalog'

  // Data states
  const [overview, setOverview] = useState(null);
  const [audits, setAudits] = useState({});
  const [dnsTraffic, setDnsTraffic] = useState([]);
  const [threatAlerts, setThreatAlerts] = useState([]);
  const [portsCatalog, setPortsCatalog] = useState([]);

  // ARP Guard data state
  const [arpData, setArpData] = useState(null);
  const [arpLoading, setArpLoading] = useState(false);

  // Honeypot Decoy Sensor state
  const [honeypotStatus, setHoneypotStatus] = useState(null);
  const [honeypotLoading, setHoneypotLoading] = useState(false);
  const [honeypotPortInput, setHoneypotPortInput] = useState(2222);
  const [honeypotServiceSelect, setHoneypotServiceSelect] = useState('ssh');
  const [honeypotSimulating, setHoneypotSimulating] = useState(false);
  const [selectedAttackerBan, setSelectedAttackerBan] = useState(null);
  const [copiedBanCmd, setCopiedBanCmd] = useState(false);
  const [banOsTab, setBanOsTab] = useState('powershell');

  // Modal for Vulnerability Deep Dive & Remediation
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);
  const [osCommandTab, setOsCommandTab] = useState('powershell');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState(null);

  // 1-Click Unified Remediation Modal
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [remediationFormat, setRemediationFormat] = useState('powershell');
  const [remediationData, setRemediationData] = useState(null);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [remediationCopied, setRemediationCopied] = useState(false);

  // Loading & Scanning states
  const [loading, setLoading] = useState(true);
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [scanningDeviceId, setScanningDeviceId] = useState(null);
  const [isHarvestingDns, setIsHarvestingDns] = useState(false);
  const [dnsSearch, setDnsSearch] = useState('');
  const [dnsCategoryFilter, setDnsCategoryFilter] = useState('ALL');
  const [dnsThreatFilter, setDnsThreatFilter] = useState('ALL');

  // Copy helper
  const handleCopyText = (text, callback) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (callback) callback(true);
    setTimeout(() => {
      if (callback) callback(false);
    }, 2000);
  };

  // Open Vulnerability Deep Dive Modal
  const openVulnerabilityModal = (vuln, device = null) => {
    const dev = device || devices.find((d) => String(d.id) === String(vuln.deviceId) || d.ip === vuln.deviceIp || d.ip === vuln.ip);
    const catalogInfo = portsCatalog.find((p) => p.port === vuln.port) || {};

    const fullVuln = {
      ...catalogInfo,
      ...vuln,
      deviceId: vuln.deviceId || dev?.id || 'N/A',
      deviceName: vuln.deviceName || dev?.name || vuln.deviceIp || vuln.ip || 'Monitored Device',
      deviceIp: vuln.deviceIp || vuln.ip || dev?.ip || 'N/A',
      deviceType: dev?.type || 'Network Host',
      deviceStatus: dev?.status || (vuln.isOnline === false ? 'DOWN' : 'UP'),
      port: vuln.port,
      service: vuln.service || catalogInfo.service || `Port ${vuln.port}`,
      severity: vuln.severity || vuln.risk || catalogInfo.risk || 'HIGH',
      cve: vuln.cve || catalogInfo.cve || 'Known Vulnerability Vector',
      attackType: vuln.attackType || catalogInfo.attackType || 'Perimeter Exposure',
      description: vuln.description || catalogInfo.description || `Exposed service listening on port ${vuln.port}`,
      exploitTarget: vuln.exploitTarget || catalogInfo.exploitTarget || 'Unauthorized network access or service reconnaissance',
      recommendation: vuln.recommendation || vuln.mitigation || catalogInfo.mitigation || 'Restrict port access through firewall rules.',
      remediationSteps: vuln.remediationSteps || catalogInfo.remediationSteps || [
        `Block Port ${vuln.port} on external firewall interfaces.`,
        'Restrict internal access to authorized management subnets only.',
        'Enforce encryption and strong authentication on the service.'
      ],
      firewallCmd: vuln.firewallCmd || catalogInfo.firewallCmd || {
        powershell: `New-NetFirewallRule -DisplayName "Block Port ${vuln.port}" -Direction Inbound -LocalPort ${vuln.port} -Protocol TCP -Action Block`,
        linuxUfw: `sudo ufw deny ${vuln.port}/tcp`,
        linuxIptables: `sudo iptables -A INPUT -p tcp --dport ${vuln.port} -j DROP`
      }
    };

    setSelectedVulnerability(fullVuln);
    setProbeResult(null);
    setCopiedCmd(false);
  };

  const handleLiveProbePort = async () => {
    if (!selectedVulnerability?.deviceIp || !selectedVulnerability?.port) return;
    setProbeLoading(true);
    setProbeResult(null);
    try {
      const res = await api.probePort({
        ip: selectedVulnerability.deviceIp,
        port: selectedVulnerability.port
      });
      setProbeResult({
        tested: true,
        open: res.open,
        message: res.open
          ? `⚠️ Port ${selectedVulnerability.port} is still OPEN on ${selectedVulnerability.deviceIp}! Firewall rule may not be active yet.`
          : `✓ SUCCESS: Port ${selectedVulnerability.port} is now CLOSED & SECURED on ${selectedVulnerability.deviceIp}!`
      });
    } catch (err) {
      setProbeResult({
        tested: true,
        error: true,
        message: `Probe failed: ${err.message}`
      });
    } finally {
      setProbeLoading(false);
    }
  };

  // Fetch ARP Guard Telemetry
  const fetchArpGuard = async () => {
    setArpLoading(true);
    try {
      const res = await api.getArpGuardAnalysis();
      if (res && res.status === 'SUCCESS') {
        setArpData(res);
      }
    } catch (err) {
      console.error('Error fetching ARP guard:', err);
    } finally {
      setArpLoading(false);
    }
  };

  // Open 1-Click Remediation Script Modal
  const handleOpenRemediationModal = async (format = 'powershell') => {
    setShowRemediationModal(true);
    setRemediationFormat(format);
    setRemediationLoading(true);
    try {
      const res = await api.getRemediationScript(format);
      setRemediationData(res);
    } catch (err) {
      console.error('Error generating remediation script:', err);
    } finally {
      setRemediationLoading(false);
    }
  };

  const handleChangeRemediationFormat = async (format) => {
    setRemediationFormat(format);
    setRemediationLoading(true);
    try {
      const res = await api.getRemediationScript(format);
      setRemediationData(res);
    } catch (err) {
      console.error('Error switching script format:', err);
    } finally {
      setRemediationLoading(false);
    }
  };

  const handleDownloadRemediationScript = () => {
    if (!remediationData?.script) return;
    const blob = new Blob([remediationData.script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = remediationData.filename || `netpulse_remediation_${Date.now()}.${remediationFormat === 'powershell' ? 'ps1' : 'sh'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Honeypot Decoy Sensor Actions
  const fetchHoneypotData = async () => {
    try {
      const status = await api.getHoneypotStatus();
      setHoneypotStatus(status);
      if (status?.port) setHoneypotPortInput(status.port);
      if (status?.emulatedService) setHoneypotServiceSelect(status.emulatedService);
    } catch (err) {
      console.error('Error fetching honeypot status:', err);
    }
  };

  const handleToggleHoneypot = async () => {
    setHoneypotLoading(true);
    try {
      const nextEnabled = !honeypotStatus?.running;
      const res = await api.toggleHoneypot(nextEnabled);
      setHoneypotStatus(res);
    } catch (err) {
      alert(`Error toggling honeypot: ${err.message}`);
    } finally {
      setHoneypotLoading(false);
    }
  };

  const handleSaveHoneypotConfig = async () => {
    setHoneypotLoading(true);
    try {
      const res = await api.configHoneypot({
        port: Number(honeypotPortInput) || 2222,
        emulatedService: honeypotServiceSelect
      });
      setHoneypotStatus(res);
    } catch (err) {
      alert(`Error saving honeypot config: ${err.message}`);
    } finally {
      setHoneypotLoading(false);
    }
  };

  const handleSimulateProbe = async () => {
    setHoneypotSimulating(true);
    try {
      const res = await api.simulateHoneypotProbe();
      if (res.success) {
        await fetchHoneypotData();
        const threats = await api.getThreatAlerts();
        setThreatAlerts(threats);
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setHoneypotSimulating(false);
    }
  };

  const handleClearHoneypotLogs = async () => {
    if (!window.confirm('Clear all honeypot intrusion hit logs?')) return;
    try {
      await api.clearHoneypotLogs();
      await fetchHoneypotData();
    } catch (err) {
      alert(`Error clearing honeypot logs: ${err.message}`);
    }
  };

  // Initial Data Fetch
  const fetchAllSecurityData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [overRes, auditsRes, trafficRes, threatsRes, catRes, arpRes, honeyRes] = await Promise.all([
        api.getSecurityOverview().catch(() => null),
        api.getSecurityAudits().catch(() => ({})),
        api.getDnsTraffic({ limit: 150 }).catch(() => ({ traffic: [] })),
        api.getThreatAlerts().catch(() => []),
        api.getPortsCatalog().catch(() => ({ ports: [] })),
        api.getArpGuardAnalysis().catch(() => null),
        api.getHoneypotStatus().catch(() => null)
      ]);

      if (overRes) setOverview(overRes);
      if (auditsRes) setAudits(auditsRes);
      if (trafficRes?.traffic) setDnsTraffic(trafficRes.traffic);
      if (threatsRes) setThreatAlerts(threatsRes);
      if (catRes?.ports) setPortsCatalog(catRes.ports);
      if (arpRes && arpRes.status === 'SUCCESS') setArpData(arpRes);
      if (honeyRes) {
        setHoneypotStatus(honeyRes);
        if (honeyRes.port) setHoneypotPortInput(honeyRes.port);
        if (honeyRes.emulatedService) setHoneypotServiceSelect(honeyRes.emulatedService);
      }
    } catch (err) {
      console.error('Error fetching security data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSecurityData();
    const interval = setInterval(() => {
      fetchAllSecurityData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Action: Audit Single Device
  const handleScanDevice = async (device) => {
    setScanningDeviceId(device.id);
    try {
      const report = await api.scanDeviceSecurity({
        deviceId: device.id,
        ip: device.ip,
        name: device.name
      });
      setAudits((prev) => ({ ...prev, [device.id]: report }));
      const newOverview = await api.getSecurityOverview();
      setOverview(newOverview);
      const threats = await api.getThreatAlerts();
      setThreatAlerts(threats);
    } catch (err) {
      alert(`Error auditing device ${device.name}: ${err.message}`);
    } finally {
      setScanningDeviceId(null);
    }
  };

  // Action: Audit All Devices
  const handleScanAll = async () => {
    setIsScanningAll(true);
    try {
      const res = await api.scanAllSecurity();
      if (res.results) {
        const auditMap = {};
        res.results.forEach((r) => {
          auditMap[r.deviceId] = r;
        });
        setAudits((prev) => ({ ...prev, ...auditMap }));
      }
      if (res.overview) setOverview(res.overview);
      const threats = await api.getThreatAlerts();
      setThreatAlerts(threats);
    } catch (err) {
      alert(`Audit failed: ${err.message}`);
    } finally {
      setIsScanningAll(false);
    }
  };

  // Action: Harvest DNS
  const handleHarvestDns = async () => {
    setIsHarvestingDns(true);
    try {
      const res = await api.harvestDnsCache();
      if (res.traffic) {
        setDnsTraffic(res.traffic);
      }
      const threats = await api.getThreatAlerts();
      setThreatAlerts(threats);
    } catch (err) {
      alert(`Error harvesting DNS: ${err.message}`);
    } finally {
      setIsHarvestingDns(false);
    }
  };

  // Action: Clear DNS
  const handleClearDns = async () => {
    if (!window.confirm('Clear all captured DNS telemetry history?')) return;
    try {
      await api.clearDnsTraffic();
      setDnsTraffic([]);
    } catch (err) {
      alert(`Error clearing DNS: ${err.message}`);
    }
  };

  // Action: Resolve Threat Alert
  const handleResolveThreat = async (threatId) => {
    try {
      await api.resolveThreatAlert(threatId);
      setThreatAlerts((prev) => prev.filter((t) => t.id !== threatId));
    } catch (err) {
      alert(`Error resolving threat: ${err.message}`);
    }
  };

  const isDeviceOffline = (d) => {
    const isMonitored = d.monitoring !== false;
    const isDownStatus = (d.status || '').toUpperCase() === 'DOWN';
    return isMonitored && isDownStatus;
  };

  const onlineCount = devices.filter((d) => !isDeviceOffline(d)).length;
  const offlineCount = devices.length - onlineCount;
  const networkScore = overview?.networkScore ?? 100;
  const threatLevel = overview?.networkThreatLevel ?? 'SAFE';
  const isArpPoisoned = arpData?.isPoisoned || false;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* TOP HEADER: SOC CYBER DEFENSE BANNER */}
      <div className="p-4 sm:p-6 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-slate-950 text-white relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                Autonomous Cyber SOC Active
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                Port Probing • DNS Telemetry • ARP Guard • Zero-Trust
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-cyan-400 shrink-0" />
              <span>Cyber Threat & Attack Surface Security Hub</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Real-time Layer-2 ARP spoofing detection, active TCP/UDP exploit port auditing, decoy honeypot traps, and 1-click firewall remediation.
            </p>
          </div>

          {/* Quick Action Buttons (Responsive flex-wrap) */}
          <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
            <button
              onClick={() => handleOpenRemediationModal('powershell')}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              title="Generate and download unified firewall remediation script"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>1-Click Remediation</span>
            </button>

            <button
              onClick={handleScanAll}
              disabled={isScanningAll}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Audit open exploit ports across all active online devices"
            >
              <Radar className={`w-3.5 h-3.5 ${isScanningAll ? 'animate-spin' : ''}`} />
              <span>{isScanningAll ? 'Auditing Hosts...' : 'Scan Online Hosts'}</span>
            </button>

            <button
              onClick={() => fetchAllSecurityData()}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors cursor-pointer"
              title="Refresh security telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* HERO KPI CARDS: 4-COLUMN RESPONSIVE METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Network Cyber Score */}
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Network Cyber Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl sm:text-2xl font-black ${networkScore >= 85 ? 'text-emerald-500' : networkScore >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                {networkScore >= 90 ? 'Grade A' : networkScore >= 75 ? 'Grade B' : networkScore >= 60 ? 'Grade C' : 'Grade F'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {networkScore >= 85 ? 'Hardened' : networkScore >= 70 ? 'Guarded' : 'At Risk'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {overview?.auditedOnlineCount || 0} online hosts audited
            </p>
          </div>
          <CyberScoreGauge score={networkScore} />
        </div>

        {/* Card 2: Threat Posture */}
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Perimeter Threat Posture
            </span>
            <div className={`p-2 rounded-xl ${threatLevel === 'SAFE' ? 'bg-emerald-500/10 text-emerald-500' : threatLevel === 'ELEVATED' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500 animate-pulse'}`}>
              {threatLevel === 'SAFE' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-lg sm:text-xl font-black tracking-tight ${threatLevel === 'SAFE' ? 'text-emerald-500' : threatLevel === 'ELEVATED' ? 'text-amber-500' : 'text-rose-500'}`}>
              {threatLevel === 'SAFE' ? 'SECURED (CLEAN)' : threatLevel === 'ELEVATED' ? 'ELEVATED EXPOSURE' : 'CRITICAL ATTACK RISK'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {threatLevel === 'SAFE' ? 'Zero perimeter exploit ports detected.' : `${overview?.vulnerableDevicesCount || 0} host(s) listening on high-risk ports.`}
          </p>
        </div>

        {/* Card 3: Attack Surface Open Ports */}
        <div
          onClick={() => setActiveSubTab('attack-surface')}
          className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm space-y-2 cursor-pointer hover:border-blue-500/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">
              Exposed Open Ports
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
              <Unlock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {overview?.totalOpenPorts || 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              across {overview?.auditedOnlineCount || 0} active hosts
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            {overview?.breakdown?.critical > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold font-mono">
                {overview.breakdown.critical} Critical
              </span>
            )}
            {overview?.breakdown?.high > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold font-mono">
                {overview.breakdown.high} High
              </span>
            )}
            {(!overview?.totalOpenPorts || overview?.totalOpenPorts === 0) && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold font-mono">
                All Ports Sealed
              </span>
            )}
          </div>
        </div>

        {/* Card 4: ARP Guard & MITM Detector */}
        <div
          onClick={() => setActiveSubTab('arp-guard')}
          className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm space-y-2 cursor-pointer hover:border-cyan-500/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-cyan-500 transition-colors">
              ARP Guard & MITM
            </span>
            <div className={`p-2 rounded-xl ${isArpPoisoned ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-cyan-500/10 text-cyan-500'} group-hover:scale-105 transition-transform`}>
              <Network className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-black ${isArpPoisoned ? 'text-rose-500' : 'text-emerald-500'}`}>
              {isArpPoisoned ? 'MITM DETECTED!' : 'CLEAN (No Poison)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate">
            {arpData?.gateway?.ip ? `GW: ${arpData.gateway.ip}` : `${arpData?.stats?.totalEntries || 0} L2 neighbors`}
          </p>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS BAR (100% RESPONSIVE WRAPPER) */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl overflow-x-auto max-w-full no-scrollbar scroll-smooth shrink-0">
          <button
            onClick={() => setActiveSubTab('attack-surface')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'attack-surface'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Attack Surface</span>
          </button>

          <button
            onClick={() => setActiveSubTab('arp-guard')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'arp-guard'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span>ARP Guard</span>
            {isArpPoisoned && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('honeypot')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'honeypot'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Crosshair className={`w-3.5 h-3.5 shrink-0 ${honeypotStatus?.running ? 'text-amber-500' : 'text-slate-400'}`} />
            <span>Honeypot Sensor</span>
            {honeypotStatus?.stats?.totalHits > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-white">
                {honeypotStatus.stats.totalHits}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('rogue-guard')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'rogue-guard'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Zero-Trust Asset Guard</span>
          </button>

          <button
            onClick={() => setActiveSubTab('dns-traffic')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'dns-traffic'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>DNS & Web Stream</span>
          </button>

          <button
            onClick={() => setActiveSubTab('threat-alerts')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'threat-alerts'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Threat Incidents</span>
            {threatAlerts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold">
                {threatAlerts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('port-catalog')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'port-catalog'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span>Port Catalog</span>
          </button>
        </div>

        <button
          onClick={() => handleOpenRemediationModal('powershell')}
          className="self-end md:self-auto px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileCode className="w-3.5 h-3.5 text-emerald-500" />
          <span>Firewall Rules</span>
        </button>
      </div>

      {/* SUB-TABS CONTENT ROUTING */}
      {activeSubTab === 'attack-surface' && (
        <AttackSurfaceTab
          devices={devices}
          audits={audits}
          scanningDeviceId={scanningDeviceId}
          isScanningAll={isScanningAll}
          handleScanDevice={handleScanDevice}
          openVulnerabilityModal={openVulnerabilityModal}
          handleCopyText={handleCopyText}
          isLocalIp={isLocalIp}
        />
      )}

      {activeSubTab === 'arp-guard' && (
        <ArpGuardTab
          arpData={arpData}
          arpLoading={arpLoading}
          isArpPoisoned={isArpPoisoned}
          fetchArpGuard={fetchArpGuard}
          handleCopyText={handleCopyText}
        />
      )}

      {activeSubTab === 'honeypot' && (
        <HoneypotSensorTab
          honeypotStatus={honeypotStatus}
          honeypotLoading={honeypotLoading}
          honeypotPortInput={honeypotPortInput}
          setHoneypotPortInput={setHoneypotPortInput}
          honeypotServiceSelect={honeypotServiceSelect}
          setHoneypotServiceSelect={setHoneypotServiceSelect}
          honeypotSimulating={honeypotSimulating}
          handleSimulateProbe={handleSimulateProbe}
          handleToggleHoneypot={handleToggleHoneypot}
          handleSaveHoneypotConfig={handleSaveHoneypotConfig}
          handleClearHoneypotLogs={handleClearHoneypotLogs}
          handleCopyText={handleCopyText}
          setSelectedAttackerBan={setSelectedAttackerBan}
        />
      )}

      {activeSubTab === 'rogue-guard' && (
        <RogueAssetGuardTab onThreatAlertUpdate={fetchAllSecurityData} />
      )}

      {activeSubTab === 'dns-traffic' && (
        <DnsTrafficTab
          dnsTraffic={dnsTraffic}
          dnsSearch={dnsSearch}
          setDnsSearch={setDnsSearch}
          dnsCategoryFilter={dnsCategoryFilter}
          setDnsCategoryFilter={setDnsCategoryFilter}
          dnsThreatFilter={dnsThreatFilter}
          setDnsThreatFilter={setDnsThreatFilter}
          isHarvestingDns={isHarvestingDns}
          handleHarvestDns={handleHarvestDns}
          handleClearDns={handleClearDns}
          handleCopyText={handleCopyText}
        />
      )}

      {activeSubTab === 'threat-alerts' && (
        <ThreatAlertsTab
          threatAlerts={threatAlerts}
          handleOpenRemediationModal={handleOpenRemediationModal}
          openVulnerabilityModal={openVulnerabilityModal}
          handleResolveThreat={handleResolveThreat}
        />
      )}

      {activeSubTab === 'port-catalog' && (
        <PortCatalogTab
          portsCatalog={portsCatalog}
          openVulnerabilityModal={openVulnerabilityModal}
        />
      )}

      {/* MODALS */}
      <VulnerabilityModal
        selectedVulnerability={selectedVulnerability}
        onClose={() => setSelectedVulnerability(null)}
        osCommandTab={osCommandTab}
        setOsCommandTab={setOsCommandTab}
        copiedCmd={copiedCmd}
        handleCopyText={handleCopyText}
        setCopiedCmd={setCopiedCmd}
        handleLiveProbePort={handleLiveProbePort}
        probeLoading={probeLoading}
        probeResult={probeResult}
      />

      <RemediationModal
        isOpen={showRemediationModal}
        onClose={() => setShowRemediationModal(false)}
        remediationFormat={remediationFormat}
        remediationData={remediationData}
        remediationLoading={remediationLoading}
        remediationCopied={remediationCopied}
        handleChangeRemediationFormat={handleChangeRemediationFormat}
        handleCopyText={handleCopyText}
        setRemediationCopied={setRemediationCopied}
        handleDownloadRemediationScript={handleDownloadRemediationScript}
      />

      <AttackerBanModal
        selectedAttackerBan={selectedAttackerBan}
        onClose={() => setSelectedAttackerBan(null)}
        banOsTab={banOsTab}
        setBanOsTab={setBanOsTab}
        copiedBanCmd={copiedBanCmd}
        handleCopyText={handleCopyText}
        setCopiedBanCmd={setCopiedBanCmd}
      />
    </div>
  );
}
