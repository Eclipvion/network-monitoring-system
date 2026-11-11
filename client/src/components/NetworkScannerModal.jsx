import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Radar,
  Search,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Server,
  Layers,
  ArrowRight,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Cpu,
  Filter
} from 'lucide-react';
import api from '../services/api';

export default function NetworkScannerModal({ isOpen, onClose, onDevicesAdded, existingDevices = [] }) {
  const [startIp, setStartIp] = useState('');
  const [endIp, setEndIp] = useState('');
  const [detectedSubnet, setDetectedSubnet] = useState('');
  const [localIp, setLocalIp] = useState('');
  
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedIps, setSelectedIps] = useState(new Set());
  const [deviceTypes, setDeviceTypes] = useState({});
  const [deviceNames, setDeviceNames] = useState({});
  const [adding, setAdding] = useState(false);
  const [copiedIp, setCopiedIp] = useState(null);
  const [error, setError] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'NEW' | 'EXISTING'

  // Fetch local network info on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSearchFilter('');
      setStatusFilter('ALL');
      api.getNetworkInfo()
        .then((info) => {
          setLocalIp(info.localIp);
          setDetectedSubnet(info.subnet);
          setStartIp(info.startIp);
          setEndIp(info.endIp);
        })
        .catch(() => {
          setStartIp('172.18.1.1');
          setEndIp('172.18.1.254');
          setDetectedSubnet('172.18.1.0/24');
        });
    } else {
      setScanResult(null);
      setSelectedIps(new Set());
      setScanning(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    if (!startIp || !endIp) {
      setError('Please provide start and end IP addresses.');
      return;
    }
    setError('');
    setScanning(true);
    setScanResult(null);
    setSelectedIps(new Set());

    try {
      const res = await api.scanNetwork({ startIp, endIp });
      setScanResult(res);

      // Auto-select devices that are NOT already in the NMS
      const newSelected = new Set();
      const initialTypes = {};
      const initialNames = {};

      (res.devices || []).forEach((dev) => {
        initialTypes[dev.ip] = dev.type || 'server';
        initialNames[dev.ip] = dev.hostname || dev.name || `Device ${dev.ip}`;
        if (!dev.alreadyAdded) {
          newSelected.add(dev.ip);
        }
      });

      setDeviceTypes(initialTypes);
      setDeviceNames(initialNames);
      setSelectedIps(newSelected);
    } catch (err) {
      setError(err.message || 'Network scan failed');
    } finally {
      setScanning(false);
    }
  };

  const toggleSelectAll = () => {
    if (!scanResult?.devices) return;
    const newItems = scanResult.devices.filter((d) => !d.alreadyAdded);
    if (selectedIps.size === newItems.length) {
      setSelectedIps(new Set());
    } else {
      setSelectedIps(new Set(newItems.map((d) => d.ip)));
    }
  };

  const toggleSelectDevice = (ip) => {
    setSelectedIps((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) {
        next.delete(ip);
      } else {
        next.add(ip);
      }
      return next;
    });
  };

  // Filtered devices list for instant searching & status filtering
  const filteredDevices = useMemo(() => {
    if (!scanResult?.devices) return [];
    const q = (searchFilter || '').toLowerCase().trim();
    return scanResult.devices.filter((dev) => {
      if (statusFilter === 'NEW' && dev.alreadyAdded) return false;
      if (statusFilter === 'EXISTING' && !dev.alreadyAdded) return false;
      if (!q) return true;
      const name = String(deviceNames[dev.ip] || dev.name || '').toLowerCase();
      const host = String(dev.hostname || '').toLowerCase();
      const ip = String(dev.ip || '').toLowerCase();
      const type = String(deviceTypes[dev.ip] || dev.type || '').toLowerCase();
      const vendor = String(dev.vendor || '').toLowerCase();
      return name.includes(q) || host.includes(q) || ip.includes(q) || type.includes(q) || vendor.includes(q);
    });
  }, [scanResult, searchFilter, statusFilter, deviceNames, deviceTypes]);

  const newDevicesCount = scanResult?.devices ? scanResult.devices.filter(d => !d.alreadyAdded).length : 0;
  const existingDevicesCount = scanResult?.devices ? scanResult.devices.filter(d => d.alreadyAdded).length : 0;

  const handleBatchAdd = async () => {
    if (selectedIps.size === 0) return;
    setAdding(true);
    try {
      const devicesToAdd = Array.from(selectedIps).map((ip) => ({
        ip,
        name: deviceNames[ip] || `Device ${ip}`,
        type: deviceTypes[ip] || 'server',
        group: 'Local Network',
        interval: 15,
        monitoring: true
      }));

      await api.batchAddDevices(devicesToAdd);
      if (onDevicesAdded) {
        await onDevicesAdded();
      }
      onClose();
    } catch (err) {
      setError(`Failed to import devices: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleCopyIp = (ip) => {
    navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-2xs">
              <Radar className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  Auto-Detect Devices (Network Discovery)
                </h3>
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Subnet Scanner
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically sweep your local network to discover alive IPs, hostnames, and devices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Controls Bar */}
        <div className="p-3.5 sm:p-5 bg-slate-50/80 dark:bg-slate-800/25 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Start IP
              </label>
              <input
                type="text"
                value={startIp}
                onChange={(e) => setStartIp(e.target.value)}
                placeholder="172.18.1.1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex-1 min-w-[130px]">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                End IP
              </label>
              <input
                type="text"
                value={endIp}
                onChange={(e) => setEndIp(e.target.value)}
                placeholder="172.18.1.254"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <button
              onClick={handleStartScan}
              disabled={scanning}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all shrink-0 h-[38px] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning Network...' : 'Start Discovery Scan'}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Your Adapter IP: <strong className="font-mono text-slate-700 dark:text-slate-200">{localIp || 'Detecting...'}</strong></span>
              <span className="hidden sm:inline opacity-40">•</span>
              <span>Detected Subnet: <strong className="font-mono text-emerald-500 font-bold">{detectedSubnet || '172.18.1.0/24'}</strong></span>
            </div>
            <span className="text-[11px] text-slate-400">Multi-threaded parallel ICMP &amp; TCP probe</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 min-h-0 flex flex-col p-3.5 sm:p-5 overflow-hidden">
          {scanning ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4 my-auto">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <Radar className="w-6 h-6 text-emerald-500 absolute inset-0 m-auto" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Scanning Subnet Range ({startIp} - {endIp})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Checking ICMP echo and ports 80, 443, 445, 22 on 254 IP addresses in parallel...
                </p>
              </div>
            </div>
          ) : scanResult ? (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              {/* Scan Summary & Fast Filter Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Scanned Hosts:</span>
                    <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{scanResult.totalScanned}</p>
                  </div>
                  <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Alive Found:</span>
                    <p className="text-sm font-black text-emerald-500 font-mono">{scanResult.aliveCount}</p>
                  </div>
                  <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">New to Add:</span>
                    <p className="text-sm font-black text-indigo-500 font-mono">{newDevicesCount}</p>
                  </div>
                </div>

                {/* Filter Controls & Search Input */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search alive hosts */}
                  <div className="relative min-w-[180px] sm:min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search host, IP, vendor..."
                      className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {searchFilter && (
                      <button
                        onClick={() => setSearchFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Segmented Buttons */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                        statusFilter === 'ALL'
                          ? 'bg-slate-900 text-white dark:bg-slate-700'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      All ({scanResult.devices.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('NEW')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                        statusFilter === 'NEW'
                          ? 'bg-emerald-500 text-white'
                          : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      New ({newDevicesCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('EXISTING')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                        statusFilter === 'EXISTING'
                          ? 'bg-slate-600 text-white dark:bg-slate-600'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      In NMS ({existingDevicesCount})
                    </button>
                  </div>

                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {selectedIps.size === newDevicesCount ? 'Deselect All' : `Select All New (${newDevicesCount})`}
                  </button>
                </div>
              </div>

              {/* Devices Table - Full Auto-Responsiveness with Sticky Header & Never Cut Off Status */}
              <div className="flex-1 min-h-[300px] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3 w-12 text-center">Select</th>
                      <th className="py-2.5 px-3 min-w-[170px]">Device Name / Host</th>
                      <th className="py-2.5 px-3 min-w-[130px]">IP Address</th>
                      <th className="py-2.5 px-3 min-w-[130px]">Type</th>
                      <th className="py-2.5 px-2.5 min-w-[70px] text-center">Latency</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Open Ports</th>
                      <th className="py-2.5 px-3 min-w-[110px] text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredDevices.map((dev) => {
                      const isSelected = selectedIps.has(dev.ip);
                      const isExisting = dev.alreadyAdded;

                      return (
                        <tr
                          key={dev.ip}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              disabled={isExisting}
                              checked={isSelected}
                              onChange={() => toggleSelectDevice(dev.ip)}
                              className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 disabled:opacity-30 cursor-pointer"
                            />
                          </td>

                          <td className="py-2.5 px-3 min-w-[170px] max-w-[220px]">
                            <input
                              type="text"
                              disabled={isExisting}
                              value={deviceNames[dev.ip] || dev.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDeviceNames((prev) => ({ ...prev, [dev.ip]: val }));
                              }}
                              className="font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:outline-none px-1 py-0.5 rounded text-xs w-full"
                            />
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 px-1">
                              {dev.hostname && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[120px]" title={dev.hostname}>
                                  {dev.hostname}
                                </span>
                              )}
                              {dev.vendor && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 truncate max-w-[110px]" title={dev.vendor}>
                                  {dev.vendor}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 min-w-[130px] whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-200 text-xs">
                              <span className="font-bold">{dev.ip}</span>
                              <button
                                onClick={() => handleCopyIp(dev.ip)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                                title="Copy IP"
                              >
                                {copiedIp === dev.ip ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {dev.mac && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {dev.mac}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 min-w-[130px]">
                            <select
                              disabled={isExisting}
                              value={deviceTypes[dev.ip] || dev.type}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDeviceTypes((prev) => ({ ...prev, [dev.ip]: val }));
                              }}
                              className="w-full px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium capitalize cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="mobile">Mobile / Phone</option>
                              <option value="router">Router / Gateway</option>
                              <option value="workstation">Workstation / PC</option>
                              <option value="server">Server</option>
                              <option value="iot">Smart / IoT</option>
                              <option value="printer">Printer</option>
                              <option value="switch">Switch</option>
                              <option value="other">Other</option>
                            </select>
                          </td>

                          <td className="py-2.5 px-2.5 min-w-[70px] font-mono text-center whitespace-nowrap">
                            <span className="text-emerald-500 font-black">
                              {dev.latency} ms
                            </span>
                          </td>

                          <td className="py-2.5 px-3 min-w-[110px]">
                            <div className="flex flex-wrap items-center gap-1">
                              {dev.method && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                  dev.method.includes('ARP') 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                }`}>
                                  {dev.method}
                                </span>
                              )}
                              {dev.openPorts && dev.openPorts.length > 0 && (
                                dev.openPorts.map((p) => (
                                  <span
                                    key={p}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px] font-semibold"
                                  >
                                    :{p}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Status Column - Perfectly Centered, Never Cut Off */}
                          <td className="py-2.5 px-3 min-w-[110px] text-center whitespace-nowrap">
                            {isExisting ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>In NMS</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
                                <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>Discovered</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredDevices.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400">
                          {searchFilter ? `No alive devices matched "${searchFilter}".` : `No responding hosts found in range ${startIp} - ${endIp}.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Ready to Discover Network Devices
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Click "Start Discovery Scan" above to sweep your subnet ({detectedSubnet || '172.18.1.0/24'}) and auto-detect all connected computers, machines, printers, and servers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 px-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left w-full sm:w-auto">
            {scanResult && (
              <span>
                Selected: <strong className="text-emerald-500 font-bold">{selectedIps.size}</strong> devices to add
                {filteredDevices.length !== scanResult.devices.length && (
                  <span className="text-slate-400 ml-1.5 font-mono text-[11px]">(Showing {filteredDevices.length} of {scanResult.devices.length})</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center"
            >
              Close
            </button>
            <button
              onClick={handleBatchAdd}
              disabled={selectedIps.size === 0 || adding}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{adding ? 'Adding Devices...' : `Add Selected (${selectedIps.size}) to Monitoring`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
