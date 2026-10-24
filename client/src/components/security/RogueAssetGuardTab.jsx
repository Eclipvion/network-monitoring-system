import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Copy,
  Check,
  UserCheck,
  UserX,
  Lock,
  Terminal,
  X,
  PlusCircle,
  Network
} from 'lucide-react';
import api from '../../services/api';

export default function RogueAssetGuardTab({ onThreatAlertUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ROGUE' | 'APPROVED'
  const [modalAsset, setModalAsset] = useState(null); // Asset being authorized
  const [friendlyName, setFriendlyName] = useState('');
  const [deviceType, setDeviceType] = useState('workstation');
  const [selectedBanAsset, setSelectedBanAsset] = useState(null); // Asset being banned
  const [copiedBan, setCopiedBan] = useState(false);

  const fetchAssetData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.getAssetGuard();
      setData(res);
      if (onThreatAlertUpdate) onThreatAlertUpdate();
    } catch (err) {
      console.error('Error fetching Asset Guard data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetData();
    const interval = setInterval(() => fetchAssetData(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleZeroTrust = async () => {
    try {
      const nextMode = !data?.zeroTrustMode;
      const res = await api.setAssetGuardMode(nextMode);
      setData((prev) => ({ ...prev, zeroTrustMode: res.zeroTrustMode }));
      fetchAssetData(true);
    } catch (err) {
      alert(`Error toggling zero trust: ${err.message}`);
    }
  };

  const handleAuthorizeAll = async () => {
    if (!window.confirm('Authorize all current active LAN devices into the approved asset whitelist?')) return;
    try {
      setLoading(true);
      await api.authorizeAllAssets(data?.assets || []);
      await fetchAssetData();
    } catch (err) {
      alert(`Error authorizing assets: ${err.message}`);
    }
  };

  const handleOpenAuthModal = (asset) => {
    setModalAsset(asset);
    setFriendlyName(asset.friendlyName !== 'Unapproved LAN Host' ? asset.friendlyName : `${asset.vendor?.split(' ')[0] || 'Device'} (${asset.ip})`);
    setDeviceType(asset.isGateway ? 'router' : 'workstation');
  };

  const handleSaveAuthorization = async () => {
    if (!modalAsset) return;
    try {
      await api.authorizeAsset({
        mac: modalAsset.mac,
        ip: modalAsset.ip,
        name: friendlyName,
        type: deviceType,
        notes: `Whitelisted via SOC on ${new Date().toLocaleDateString()}`
      });
      setModalAsset(null);
      await fetchAssetData();
    } catch (err) {
      alert(`Authorization failed: ${err.message}`);
    }
  };

  const handleRevoke = async (mac) => {
    if (!window.confirm(`Revoke authorization for MAC ${mac}? It will be treated as an unapproved rogue host.`)) return;
    try {
      await api.revokeAsset(mac);
      await fetchAssetData();
    } catch (err) {
      alert(`Revocation failed: ${err.message}`);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedBan(true);
    setTimeout(() => setCopiedBan(false), 2000);
  };

  const filteredAssets = useMemo(() => {
    if (!data?.assets) return [];
    return data.assets.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.ip.toLowerCase().includes(q) ||
        a.mac.toLowerCase().includes(q) ||
        (a.friendlyName && a.friendlyName.toLowerCase().includes(q)) ||
        (a.vendor && a.vendor.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ROGUE' && !a.isApproved) ||
        (statusFilter === 'APPROVED' && a.isApproved);

      return matchesSearch && matchesStatus;
    });
  }, [data, searchQuery, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Control & Command Header */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-2xl shrink-0 ${
              data?.zeroTrustMode ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Zero-Trust Asset Guard & Rogue MAC Whitelist
                </h3>
                {data?.zeroTrustMode ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-mono">
                    STRICT ZERO-TRUST ACTIVE
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                    PERMISSIVE / LEARNING MODE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically identifies unauthorized laptops, rogue Wi-Fi clients, and unmanaged devices joining the LAN.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            <button
              onClick={handleAuthorizeAll}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all cursor-pointer"
              title="Whitelist all currently connected devices as initial authorized baseline"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-500" />
              <span>Whitelist Current As Baseline</span>
            </button>

            <button
              onClick={handleToggleZeroTrust}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                data?.zeroTrustMode
                  ? 'bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{data?.zeroTrustMode ? 'Disable Strict Mode' : 'Enable Zero-Trust'}</span>
            </button>

            <button
              onClick={() => fetchAssetData()}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 transition-colors cursor-pointer"
              title="Refresh LAN Asset Audit"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Rogue Alert Banner */}
        {data?.rogueCount > 0 && data?.zeroTrustMode && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
              <div>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-xs">
                  {data.rogueCount} Unapproved Host{data.rogueCount > 1 ? 's' : ''} Detected on Local Subnet!
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Unrecognized MAC addresses are communicating on the network without Zero-Trust authorization.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStatusFilter('ROGUE')}
              className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Filter Rogue Hosts
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Approved White-listed Assets
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-500">
              {data?.approvedCount || 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">trusted devices</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Known hardware authorized to access internal network assets
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Rogue / Unapproved Intruders
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${
              data?.rogueCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-900 dark:text-white'
            }`}>
              {data?.rogueCount || 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">unauthorized hosts</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {data?.zeroTrustMode ? 'Flagged for isolation or authorization' : 'Strict mode is paused'}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total L2 Neighbor Endpoints
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {data?.totalTracked || 0}
            </span>
            <span className="text-xs text-slate-400 font-mono">active ARP neighbors</span>
          </div>
          <p className="text-[11px] text-cyan-500 font-medium">
            Layer-2 MAC telemetry actively audited
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search IP, MAC address, friendly name, or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
          />
        </div>

        <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Hosts ({data?.assets?.length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('ROGUE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'ROGUE'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-rose-500 hover:bg-rose-500/10'
            }`}
          >
            Rogue Only ({data?.rogueCount || 0})
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            Approved ({data?.approvedCount || 0})
          </button>
        </div>
      </div>

      {/* Asset Inventory Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Endpoint IP & MAC</th>
                <th className="py-3 px-4">Friendly Asset Identity</th>
                <th className="py-3 px-4">Hardware Vendor</th>
                <th className="py-3 px-4">Zero-Trust Status</th>
                <th className="py-3 px-4 text-right">Defense Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.mac}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                    !asset.isApproved ? 'bg-rose-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{asset.ip}</span>
                        {asset.isGateway && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[9px] font-mono font-bold">
                            GATEWAY
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-slate-400 text-[11px]">
                        {asset.mac}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    <span>{asset.friendlyName}</span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                      {asset.vendor}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    {asset.isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Approved Asset
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 font-mono">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        ROGUE / UNTRUSTED
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!asset.isApproved ? (
                        <>
                          <button
                            onClick={() => handleOpenAuthModal(asset)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                            title="Whitelist this device as authorized asset"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Authorize</span>
                          </button>

                          <button
                            onClick={() => setSelectedBanAsset(asset)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Generate host firewall ban rule for this device"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>Ban Host</span>
                          </button>
                        </>
                      ) : (
                        !asset.isGateway && (
                          <button
                            onClick={() => handleRevoke(asset.mac)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-500 text-xs font-semibold transition-colors cursor-pointer"
                            title="Revoke whitelist status"
                          >
                            Revoke
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs">
                    No network endpoints match the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorize Asset Modal */}
      {modalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span>Authorize Asset Whitelist</span>
              </h3>
              <button onClick={() => setModalAsset(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Friendly Asset Name:</label>
                <input
                  type="text"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  placeholder="e.g. Finance Dept Printer, John's iPhone"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Device Classification:</label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="workstation">Workstation / PC</option>
                  <option value="server">Server</option>
                  <option value="mobile">Mobile / Tablet</option>
                  <option value="printer">Printer / Scanner</option>
                  <option value="iot">IoT / Smart Device</option>
                  <option value="router">Network Switch / Router</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] text-slate-400 space-y-1">
                <div>MAC: <span className="text-slate-900 dark:text-white">{modalAsset.mac}</span></div>
                <div>IP: <span className="text-slate-900 dark:text-white">{modalAsset.ip}</span></div>
                <div>Vendor: <span className="text-slate-900 dark:text-white">{modalAsset.vendor}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setModalAsset(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAuthorization}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Whitelist Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Rogue Device Modal */}
      {selectedBanAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Rogue Host Firewall Isolation</span>
              </h3>
              <button onClick={() => setSelectedBanAsset(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400">
              Execute this command on your host or gateway to immediately sever inbound traffic from rogue host{' '}
              <strong className="text-rose-500 font-mono">{selectedBanAsset.ip}</strong> ({selectedBanAsset.mac}).
            </p>

            <div className="relative">
              <pre className="p-3.5 pr-24 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                {selectedBanAsset.firewallBanRule?.powershell}
              </pre>
              <button
                onClick={() => handleCopy(selectedBanAsset.firewallBanRule?.powershell)}
                className="absolute right-2 top-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 border border-slate-700 cursor-pointer"
              >
                {copiedBan ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBan ? 'Copied!' : 'Copy Rule'}</span>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedBanAsset(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
