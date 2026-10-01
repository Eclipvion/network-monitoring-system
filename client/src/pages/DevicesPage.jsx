import React, { useState } from 'react';
import {
  Server,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Power,
  ArrowUpRight,
  Wifi,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function DevicesPage({
  devices = [],
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onToggleMonitoring,
  onOpenDetails
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Filter devices
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ip.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || d.type.toLowerCase() === typeFilter.toLowerCase();
    const matchesStatus = statusFilter === 'ALL' || d.status.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Action Header & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device name or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="ALL">All Types</option>
            <option value="server">Servers</option>
            <option value="router">Routers</option>
            <option value="switch">Switches</option>
            <option value="workstation">Workstations / PCs</option>
            <option value="printer">Printers</option>
            <option value="gateway">Gateways</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="UP">UP Only</option>
            <option value="DOWN">DOWN Only</option>
            <option value="WARNING">WARNING Only</option>
            <option value="PAUSED">PAUSED Only</option>
          </select>
        </div>

        {/* View mode & Add Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Grid
            </button>
          </div>

          <button
            onClick={onAddDevice}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add New Device
          </button>
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {viewMode === 'table' ? (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Name & Host</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Interval</th>
                  <th className="py-3.5 px-4">Latest Latency</th>
                  <th className="py-3.5 px-4">Packet Loss</th>
                  <th className="py-3.5 px-4">Monitoring</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                {filteredDevices.map((device) => {
                  const latest = device.latestResult;
                  return (
                    <tr
                      key={device.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td
                        className="py-3.5 px-4 cursor-pointer"
                        onClick={() => onOpenDetails(device.id)}
                      >
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{device.name}</span>
                          {device.isSeed && (
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                              Seed
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-slate-400 text-[11px]">
                          {device.ip}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                          {device.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={device.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {device.interval}s
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium">
                        {latest && latest.latency !== null ? `${latest.latency} ms` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {latest && latest.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                      </td>

                      {/* Monitoring Toggle Switch */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onToggleMonitoring(device.id, !device.monitoring)}
                          title={device.monitoring ? 'Disable monitoring' : 'Enable monitoring'}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            device.monitoring ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              device.monitoring ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetails(device.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            title="Device Telemetry"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditDevice(device)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                            title="Edit Device"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteDevice(device)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Delete Device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredDevices.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 text-xs">
                      No matching devices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => {
            const latest = device.latestResult;
            return (
              <div
                key={device.id}
                className="p-5 rounded-2xl glass-panel card-hover flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="capitalize px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                      {device.type}
                    </span>
                    <StatusBadge status={device.status} size="sm" />
                  </div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white truncate">
                    {device.name}
                  </h4>
                  <p className="font-mono text-xs text-slate-400 mt-0.5">
                    {device.ip}
                  </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      Latency
                    </span>
                    <p className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {latest && latest.latency !== null ? `${latest.latency} ms` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      Loss
                    </span>
                    <p className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {latest && latest.packetLoss !== undefined ? `${latest.packetLoss}%` : '0%'}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => onToggleMonitoring(device.id, !device.monitoring)}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        device.monitoring ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          device.monitoring ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-[11px] text-slate-500">
                      {device.monitoring ? 'Active' : 'Paused'}
                    </span>
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenDetails(device.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      title="Inspect"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditDevice(device)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteDevice(device)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
