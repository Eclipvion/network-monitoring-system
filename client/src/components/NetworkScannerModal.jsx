import React, { useState, useEffect } from 'react';
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
  Cpu
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

  // Fetch local network info on open
  useEffect(() => {
    if (isOpen) {
      setError('');
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
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Radar className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Auto-Detect Devices (Network Discovery)
                </h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Subnet Scanner
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically sweep your local network to discover alive IPs, hostnames, and devices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Controls Bar */}
        <div className="p-6 bg-slate-50/60 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Start IP
              </label>
              <input
                type="text"
                value={startIp}
                onChange={(e) => setStartIp(e.target.value)}
                placeholder="172.18.1.1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                End IP
              </label>
              <input
                type="text"
                value={endIp}
                onChange={(e) => setEndIp(e.target.value)}
                placeholder="172.18.1.254"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <button
              onClick={handleStartScan}
              disabled={scanning}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all shrink-0 h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning Network...' : 'Start Discovery Scan'}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Your Adapter IP: <strong className="font-mono text-slate-700 dark:text-slate-200">{localIp || 'Detecting...'}</strong></span>
              <span>•</span>
              <span>Detected Subnet: <strong className="font-mono text-emerald-500">{detectedSubnet || '172.18.1.0/24'}</strong></span>
            </div>
            <span className="text-[11px] text-slate-400">Multi-threaded parallel ICMP & TCP probe</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {scanning ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <Radar className="w-6 h-6 text-emerald-500 absolute inset-0 m-auto" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Scanning Subnet Range ({startIp} - {endIp})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Checking ICMP echo and ports 80, 443, 445, 22 on 254 IP addresses in parallel...
                </p>
              </div>
            </div>
          ) : scanResult ? (
            <div className="space-y-4">
              {/* Scan Summary Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs text-slate-400">Scanned Hosts:</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{scanResult.totalScanned}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:border-slate-700" />
                  <div>
                    <span className="text-xs text-slate-400">Alive Devices Found:</span>
                    <p className="text-sm font-bold text-emerald-500 font-mono">{scanResult.aliveCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Select All New ({scanResult.devices.filter(d => !d.alreadyAdded).length})
                  </button>
                </div>
              </div>

              {/* Devices Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase text-slate-400">
                      <th className="py-3 px-4 w-10">Select</th>
                      <th className="py-3 px-4">Device Name / Host</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Latency</th>
                      <th className="py-3 px-4">Open Ports</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {scanResult.devices.map((dev) => {
                      const isSelected = selectedIps.has(dev.ip);
                      const isExisting = dev.alreadyAdded;

                      return (
                        <tr
                          key={dev.ip}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                            isSelected ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              disabled={isExisting}
                              checked={isSelected}
                              onChange={() => toggleSelectDevice(dev.ip)}
                              className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 disabled:opacity-40"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <input
                              type="text"
                              disabled={isExisting}
                              value={deviceNames[dev.ip] || dev.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDeviceNames((prev) => ({ ...prev, [dev.ip]: val }));
                              }}
                              className="font-medium text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:outline-none px-1 py-0.5 rounded text-xs w-48"
                            />
                            {dev.hostname && (
                              <div className="text-[10px] text-slate-400 font-mono px-1">
                                {dev.hostname}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                              <span>{dev.ip}</span>
                              <button
                                onClick={() => handleCopyIp(dev.ip)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                                title="Copy IP"
                              >
                                {copiedIp === dev.ip ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <select
                              disabled={isExisting}
                              value={deviceTypes[dev.ip] || dev.type}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDeviceTypes((prev) => ({ ...prev, [dev.ip]: val }));
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs capitalize"
                            >
                              <option value="server">Server</option>
                              <option value="router">Router</option>
                              <option value="switch">Switch</option>
                              <option value="workstation">Workstation</option>
                              <option value="printer">Printer</option>
                              <option value="gateway">Gateway</option>
                              <option value="other">Other</option>
                            </select>
                          </td>

                          <td className="py-3 px-4 font-mono">
                            <span className="text-emerald-500 font-medium">
                              {dev.latency} ms
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {dev.openPorts && dev.openPorts.length > 0 ? (
                                dev.openPorts.map((p) => (
                                  <span
                                    key={p}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px]"
                                  >
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[11px]">ICMP Only</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {isExisting ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                In NMS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                Discovered
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {scanResult.devices.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400">
                          No responding hosts found in range {startIp} - {endIp}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
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
        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {scanResult && (
              <span>
                Selected: <strong className="text-emerald-500">{selectedIps.size}</strong> devices to add
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleBatchAdd}
              disabled={selectedIps.size === 0 || adding}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              {adding ? 'Adding Devices...' : `Add Selected (${selectedIps.size}) to Monitoring`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
