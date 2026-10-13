import React, { useState, useEffect } from 'react';
import {
  Route,
  Activity,
  Layers,
  Globe,
  ShieldCheck,
  Play,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Server,
  Lock,
  Copy,
  Check,
  Download,
  Terminal,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  TrendingDown,
  Cpu,
  Radio
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import api from '../services/api';
import DnsPerformancePage from './DnsPerformancePage';

export default function DiagnosticsPage({ devices = [], initialTool = 'traceroute' }) {
  // Active diagnostic tool tab: 'traceroute' | 'ping' | 'portscan' | 'dns' | 'ssl'
  const [activeTool, setActiveTool] = useState(initialTool);

  useEffect(() => {
    if (initialTool) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  // Common target input state
  const [targetInput, setTargetInput] = useState('');
  const [selectedDevicePreset, setSelectedDevicePreset] = useState('');

  // Tool 1: Traceroute state
  const [trMaxHops, setTrMaxHops] = useState(30);
  const [trLoading, setTrLoading] = useState(false);
  const [trResult, setTrResult] = useState(null);
  const [trError, setTrError] = useState(null);

  // Tool 2: Ping & Jitter state
  const [pingCount, setPingCount] = useState(4);
  const [pingPacketSize, setPingPacketSize] = useState(32);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [pingError, setPingError] = useState(null);

  // Tool 3: Port Scanner state
  const [portsPreset, setPortsPreset] = useState('common'); // 'common' | 'web' | 'db' | 'custom'
  const [customPortsInput, setCustomPortsInput] = useState('80, 443, 22, 53, 3389, 3306, 5432, 8080');
  const [portScanLoading, setPortScanLoading] = useState(false);
  const [portScanResult, setPortScanResult] = useState(null);
  const [portScanError, setPortScanError] = useState(null);

  // Tool 4: DNS Lookup state
  const [dnsDomainInput, setDnsDomainInput] = useState('google.com');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState(null);
  const [dnsError, setDnsError] = useState(null);

  // Tool 5: SSL Inspector state
  const [sslTargetInput, setSslTargetInput] = useState('google.com');
  const [sslPort, setSslPort] = useState(443);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslResult, setSslResult] = useState(null);
  const [sslError, setSslError] = useState(null);

  // Raw CLI / Output copy indicator
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Set default target from first available device
  useEffect(() => {
    if (devices.length > 0 && !targetInput) {
      setTargetInput(devices[0].ip);
      setSelectedDevicePreset(devices[0].id.toString());
      if (devices[0].ip.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(devices[0].ip)) {
        setDnsDomainInput(devices[0].ip);
        setSslTargetInput(devices[0].ip);
      }
    }
  }, [devices]);

  // Handle Quick Device Preset selection
  const handleSelectDevice = (deviceId) => {
    setSelectedDevicePreset(deviceId);
    if (deviceId === 'custom') {
      return;
    }
    const dev = devices.find((d) => d.id.toString() === deviceId.toString());
    if (dev) {
      setTargetInput(dev.ip);
      const isDomain = dev.ip.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(dev.ip);
      if (isDomain) {
        setDnsDomainInput(dev.ip);
        setSslTargetInput(dev.ip);
      }
    }
  };

  // Run Traceroute
  const handleRunTraceroute = async () => {
    if (!targetInput.trim()) return;
    setTrLoading(true);
    setTrError(null);
    try {
      const data = await api.runTraceroute({
        target: targetInput.trim(),
        maxHops: trMaxHops
      });
      setTrResult(data);
    } catch (err) {
      setTrError(err.message || 'Traceroute diagnostic failed');
    } finally {
      setTrLoading(false);
    }
  };

  // Run Deep Ping & Jitter
  const handleRunPing = async () => {
    if (!targetInput.trim()) return;
    setPingLoading(true);
    setPingError(null);
    try {
      const data = await api.runDiagnosticPing({
        target: targetInput.trim(),
        count: pingCount,
        packetSize: pingPacketSize
      });
      setPingResult(data);
    } catch (err) {
      setPingError(err.message || 'Ping probe failed');
    } finally {
      setPingLoading(false);
    }
  };

  // Run Port Scanner
  const handleRunPortScan = async () => {
    if (!targetInput.trim()) return;
    setPortScanLoading(true);
    setPortScanError(null);
    try {
      let portsToTest = [80, 443, 22, 53, 3389, 3306, 5432, 8080];
      if (portsPreset === 'web') portsToTest = [80, 443, 8080, 8443, 3000, 5000];
      else if (portsPreset === 'db') portsToTest = [3306, 5432, 1433, 1521, 6379, 27017];
      else if (portsPreset === 'mail') portsToTest = [25, 110, 143, 465, 587, 993, 995];
      else if (portsPreset === 'admin') portsToTest = [22, 23, 3389, 445];
      else if (portsPreset === 'custom') {
        portsToTest = customPortsInput
          .split(/[\s,]+/)
          .map((p) => parseInt(p.trim(), 10))
          .filter((p) => !isNaN(p) && p >= 1 && p <= 65535);
      }

      const data = await api.runPortScan({
        target: targetInput.trim(),
        ports: portsToTest
      });
      setPortScanResult(data);
    } catch (err) {
      setPortScanError(err.message || 'Port scanner failed');
    } finally {
      setPortScanLoading(false);
    }
  };

  // Run DNS Analyzer
  const handleRunDns = async () => {
    const domain = (dnsDomainInput || targetInput).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;
    setDnsLoading(true);
    setDnsError(null);
    try {
      const data = await api.runDnsLookup({ domain });
      setDnsResult(data);
    } catch (err) {
      setDnsError(err.message || 'DNS lookup failed');
    } finally {
      setDnsLoading(false);
    }
  };

  // Run SSL / TLS Inspector
  const handleRunSsl = async () => {
    const target = (sslTargetInput || targetInput).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!target) return;
    setSslLoading(true);
    setSslError(null);
    try {
      const data = await api.runSslCheck({
        target,
        port: Number(sslPort) || 443
      });
      setSslResult(data);
    } catch (err) {
      setSslError(err.message || 'SSL inspection failed');
    } finally {
      setSslLoading(false);
    }
  };

  // Copy raw output
  const handleCopyRaw = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : text);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Route className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Network Diagnostics Suite
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-hop traceroute, precision ping & jitter prober, TCP service scanner, DNS resolver benchmarking, and SSL health auditing.
          </p>
        </div>

        {/* Global Target Scope Preset Selector */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedDevicePreset}
              onChange={(e) => handleSelectDevice(e.target.value)}
              className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
            >
              <option value="custom">Manual Target Input...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id.toString()}>
                  {d.name} ({d.ip})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Tool Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'traceroute', label: 'Visual Traceroute', icon: Route, desc: 'Hop-by-hop path routing & packet drop discovery' },
          { id: 'ping', label: 'Ping & Jitter Prober', icon: Activity, desc: 'Sequence RTT, RFC 3550 jitter, and VoIP MOS index' },
          { id: 'portscan', label: 'TCP Service Scanner', icon: Layers, desc: 'Open port audit and TCP handshake response' },
          { id: 'dns', label: 'DNS Performance Race', icon: Globe, desc: 'Multi-resolver benchmark (Google vs Cloudflare vs Quad9)' },
          { id: 'ssl', label: 'SSL / TLS Inspector', icon: ShieldCheck, desc: 'Certificate validity, expiry countdown, cipher inspection' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTool(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. VISUAL TRACEROUTE SUB-VIEW */}
      {/* ========================================================================= */}
      {activeTool === 'traceroute' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="Enter target IP or hostname (e.g. 8.8.8.8, 1.1.1.1, google.com)..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-slate-400">Max Hops:</span>
                  <select
                    value={trMaxHops}
                    onChange={(e) => setTrMaxHops(Number(e.target.value))}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-mono"
                  >
                    <option value={15}>15 hops</option>
                    <option value={30}>30 hops</option>
                    <option value={45}>45 hops</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleRunTraceroute}
                disabled={trLoading || !targetInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {trLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Tracing Path...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Start Traceroute
                  </>
                )}
              </button>
            </div>

            {trError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {trError}
              </div>
            )}
          </div>

          {/* Traceroute Results Display */}
          {trResult && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
              {/* Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Destination:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {trResult.target}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      trResult.completed
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      {trResult.completed ? 'PATH COMPLETE' : 'PARTIAL / TIMEOUT'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Evaluated {trResult.hops?.length || 0} routing hops. Captured at {new Date(trResult.timestamp).toLocaleTimeString()}.
                  </p>
                </div>

                <button
                  onClick={() => handleCopyRaw(trResult)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 self-start sm:self-auto"
                >
                  {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  {copiedRaw ? 'Copied JSON' : 'Copy Result'}
                </button>
              </div>

              {/* Hop-by-Hop Visual Nodes List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Routing Pathway (Hop Details)
                </h4>

                <div className="space-y-2">
                  {trResult.hops?.map((h, idx) => {
                    const isTimedOut = h.ip === '*' || h.latencyMs === null;
                    const isDestination = h.ip === trResult.target || idx === trResult.hops.length - 1;
                    const latency = h.latencyMs !== null ? h.latencyMs : null;

                    let latencyColor = 'text-emerald-500';
                    let barColor = 'bg-emerald-500';
                    if (latency === null) {
                      latencyColor = 'text-slate-400';
                      barColor = 'bg-slate-400';
                    } else if (latency > 150) {
                      latencyColor = 'text-rose-500';
                      barColor = 'bg-rose-500';
                    } else if (latency > 60) {
                      latencyColor = 'text-amber-500';
                      barColor = 'bg-amber-500';
                    }

                    return (
                      <div
                        key={h.hop}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                          isDestination
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : isTimedOut
                            ? 'border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 opacity-70'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            isDestination
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {h.hop}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                {isTimedOut ? '★ Request Timed Out (No ICMP reply)' : h.ip}
                              </span>
                              {isDestination && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9px] font-black uppercase">
                                  DESTINATION
                                </span>
                              )}
                              {h.hop === 1 && !isTimedOut && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 text-[9px] font-bold">
                                  LOCAL GATEWAY
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {isTimedOut ? 'Transit router filtered echo packets or exceeded TTL threshold' : `Hop #${h.hop} Router Interface`}
                            </span>
                          </div>
                        </div>

                        {/* Latency Indicator */}
                        <div className="flex items-center gap-3">
                          {latency !== null ? (
                            <div className="text-right">
                              <span className={`font-mono text-xs font-bold ${latencyColor}`}>
                                {latency}ms
                              </span>
                              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full ${barColor}`}
                                  style={{ width: `${Math.min(100, (latency / 200) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-slate-400 font-bold">
                              * * *
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PING & JITTER PROBER SUB-VIEW */}
      {/* ========================================================================= */}
      {activeTool === 'ping' && (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <input
                type="text"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="Enter target IP or hostname (e.g. 8.8.8.8, 192.168.1.1)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />

              <div className="flex flex-wrap items-center gap-2">
                {/* Count */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Packets:</span>
                  <select
                    value={pingCount}
                    onChange={(e) => setPingCount(Number(e.target.value))}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-mono"
                  >
                    <option value={4}>4 probes</option>
                    <option value={10}>10 probes</option>
                    <option value={20}>20 probes</option>
                  </select>
                </div>

                {/* Packet Size */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Size:</span>
                  <select
                    value={pingPacketSize}
                    onChange={(e) => setPingPacketSize(Number(e.target.value))}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-mono"
                  >
                    <option value={32}>32 Bytes (Std)</option>
                    <option value={64}>64 Bytes</option>
                    <option value={512}>512 Bytes</option>
                    <option value={1472}>1472 Bytes (MTU)</option>
                  </select>
                </div>

                <button
                  onClick={handleRunPing}
                  disabled={pingLoading || !targetInput.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {pingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
                  {pingLoading ? 'Probing...' : 'Transmit Probes'}
                </button>
              </div>
            </div>

            {pingError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {pingError}
              </div>
            )}
          </div>

          {pingResult && (
            <div className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Packet Loss</span>
                  <div className={`text-xl font-bold font-mono mt-1 ${
                    pingResult.packetLossPercent === 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {pingResult.packetLossPercent}%
                  </div>
                  <p className="text-[10px] text-slate-400">{pingResult.packetsReceived}/{pingResult.count} Received</p>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Average RTT</span>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {pingResult.avgLatency !== null ? `${pingResult.avgLatency}ms` : '—'}
                  </div>
                  <p className="text-[10px] text-slate-400">Min: {pingResult.minLatency ?? '—'} / Max: {pingResult.maxLatency ?? '—'}ms</p>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">RFC 3550 Jitter</span>
                  <div className="text-xl font-bold font-mono text-indigo-500 mt-1">
                    {pingResult.jitter !== null ? `${pingResult.jitter}ms` : '0ms'}
                  </div>
                  <p className="text-[10px] text-slate-400">Latency Variation</p>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">VoIP MOS Quality</span>
                  <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
                    {pingResult.mos} / 4.5
                  </div>
                  <p className="text-[10px] text-slate-400">{pingResult.mos >= 4.0 ? 'HD Audio Quality' : 'Noticeable Lag'}</p>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Probe Method</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {pingResult.method}
                  </div>
                  <p className="text-[10px] text-slate-400">{pingResult.packetSize} Bytes / probe</p>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Total Duration</span>
                  <div className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300 mt-1">
                    {pingResult.totalDurationMs}ms
                  </div>
                  <p className="text-[10px] text-slate-400">Test Execution Time</p>
                </div>
              </div>

              {/* Individual Packet Sequence Table */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Probe Sequence Log
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase text-slate-400">
                        <th className="py-2.5 px-4">Seq #</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Size</th>
                        <th className="py-2.5 px-4">Latency (ms)</th>
                        <th className="py-2.5 px-4">TTL</th>
                        <th className="py-2.5 px-4">Raw Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {pingResult.packets?.map((p) => (
                        <tr key={p.seq} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">#{p.seq}</td>
                          <td className="py-2.5 px-4">
                            {p.success ? (
                              <span className="text-emerald-500 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> UP
                              </span>
                            ) : (
                              <span className="text-rose-500 font-bold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> DROP
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{p.bytes} B</td>
                          <td className="py-2.5 px-4 font-bold text-emerald-500">
                            {p.timeMs !== null ? `${p.timeMs}ms` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{p.ttl ?? '—'}</td>
                          <td className="py-2.5 px-4 text-slate-400 text-[11px] font-sans truncate max-w-xs">{p.raw}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TCP PORT SCANNER SUB-VIEW */}
      {/* ========================================================================= */}
      {activeTool === 'portscan' && (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <input
                type="text"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="Enter host to scan (e.g. 192.168.1.1, google.com, 10.0.0.1)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />

              <div className="flex items-center gap-2">
                <select
                  value={portsPreset}
                  onChange={(e) => setPortsPreset(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  <option value="common">Common Ports (Web, SSH, RDP, DB)</option>
                  <option value="web">Web Services (80, 443, 8080, 8443, 3000)</option>
                  <option value="db">Databases (3306, 5432, 1433, 6379, 27017)</option>
                  <option value="mail">Mail Servers (25, 110, 143, 587, 993)</option>
                  <option value="admin">Remote Admin (22, 23, 3389, 445)</option>
                  <option value="custom">Custom Ports List...</option>
                </select>

                <button
                  onClick={handleRunPortScan}
                  disabled={portScanLoading || !targetInput.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {portScanLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  {portScanLoading ? 'Scanning Ports...' : 'Scan Ports'}
                </button>
              </div>
            </div>

            {portsPreset === 'custom' && (
              <div className="pt-2">
                <input
                  type="text"
                  value={customPortsInput}
                  onChange={(e) => setCustomPortsInput(e.target.value)}
                  placeholder="Enter comma-separated ports (e.g. 21, 22, 80, 443, 8080, 3000)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            )}

            {portScanError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {portScanError}
              </div>
            )}
          </div>

          {portScanResult && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Scan Results for {portScanResult.target}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {portScanResult.openCount} Open Ports
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Tested {portScanResult.portsTested} TCP ports concurrently.
                  </p>
                </div>
              </div>

              {/* Port Result Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {portScanResult.results?.map((p) => {
                  const isOpen = p.status === 'OPEN';
                  const isClosed = p.status === 'CLOSED';

                  return (
                    <div
                      key={p.port}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        isOpen
                          ? 'border-emerald-500/40 bg-emerald-500/5 shadow-sm'
                          : isClosed
                          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          : 'border-amber-500/20 bg-amber-500/5'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            Port {p.port}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOpen
                              ? 'bg-emerald-500 text-white'
                              : isClosed
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {p.service}
                        </p>
                      </div>

                      <div className="text-right font-mono text-xs">
                        {p.latencyMs ? (
                          <span className={isOpen ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                            {p.latencyMs}ms
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DNS ANALYZER & MULTI-RESOLVER BENCHMARK (40+ GLOBAL RESOLVERS) */}
      {/* ========================================================================= */}
      {activeTool === 'dns' && (
        <DnsPerformancePage />
      )}

      {/* ========================================================================= */}
      {/* 5. SSL / TLS & HTTPS HEALTH INSPECTOR SUB-VIEW */}
      {/* ========================================================================= */}
      {activeTool === 'ssl' && (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <input
                type="text"
                value={sslTargetInput}
                onChange={(e) => setSslTargetInput(e.target.value)}
                placeholder="Enter domain or HTTPS endpoint (e.g. google.com, github.com)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={sslPort}
                  onChange={(e) => setSslPort(e.target.value)}
                  placeholder="Port"
                  className="w-20 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                />

                <button
                  onClick={handleRunSsl}
                  disabled={sslLoading || !sslTargetInput.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {sslLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {sslLoading ? 'Inspecting Certificate...' : 'Inspect SSL / TLS'}
                </button>
              </div>
            </div>

            {sslError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {sslError}
              </div>
            )}
          </div>

          {sslResult && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{sslResult.target}</span>
                      {sslResult.ssl?.success && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {sslResult.ssl.protocol}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Handshake completed in {sslResult.ssl?.handshakeTimeMs || '—'}ms
                    </p>
                  </div>
                </div>

                {sslResult.ssl?.daysRemaining !== undefined && (
                  <div className={`px-4 py-2 rounded-xl border font-bold text-xs flex items-center gap-2 ${
                    sslResult.ssl.daysRemaining > 30
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : sslResult.ssl.daysRemaining > 7
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span>{sslResult.ssl.daysRemaining} Days Remaining</span>
                  </div>
                )}
              </div>

              {/* Certificate Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Certificate Authority (Issuer)</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {sslResult.ssl?.issuer || 'Unknown'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Common Name (Subject)</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                    {sslResult.ssl?.subject || 'Unknown'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Cipher Suite</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                    {sslResult.ssl?.cipher || 'Unknown'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Valid From</span>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {sslResult.ssl?.validFrom ? new Date(sslResult.ssl.validFrom).toLocaleDateString() : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Valid Until (Expiry)</span>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {sslResult.ssl?.validTo ? new Date(sslResult.ssl.validTo).toLocaleDateString() : '—'}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">HTTP Response Status</span>
                  <div className="text-sm font-bold text-emerald-500 font-mono">
                    {sslResult.http?.statusCode ? `${sslResult.http.statusCode} ${sslResult.http.statusMessage || ''}` : 'Connected'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
