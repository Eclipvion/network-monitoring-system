import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  Calendar,
  Activity,
  Layers,
  ArrowRight,
  RefreshCw,
  Server,
  FileSpreadsheet
} from 'lucide-react';
import api from '../services/api';

export default function OutageTrackerWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RESOLVED'

  const fetchOutages = async () => {
    try {
      const res = await api.getOutageTelemetry();
      if (res) {
        setData(res);
        setLoading(false);
      }
    } catch (e) {
      console.log('Outages fetch error:', e);
    }
  };

  useEffect(() => {
    fetchOutages();
    const interval = setInterval(fetchOutages, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeOutages = data?.activeOutages || [];
  const history = data?.history || [];
  const slaPercentage = data?.slaPercentage ?? 99.9;
  const mttrHuman = data?.mttrHuman || '0s';
  const slaGrade = data?.slaGrade || 'A+ Elite (99.9%)';

  const combinedList = [
    ...activeOutages.map(o => ({ ...o, isLive: true })),
    ...history.map(h => ({ ...h, isLive: false }))
  ];

  const filteredIncidents = combinedList.filter((item) => {
    if (filter === 'ACTIVE') return item.isLive;
    if (filter === 'RESOLVED') return !item.isLive;
    return true;
  });

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Outage Timeline & SLA Downtime Tracker
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                SLA Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit trail of host outages, Mean Time To Recovery (MTTR), and 99.9% SLA compliance
            </p>
          </div>
        </div>

        <button
          onClick={fetchOutages}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors self-start sm:self-auto"
          title="Refresh SLA Metrics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* SLA Compliance % */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              SLA Uptime
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {slaPercentage}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {slaGrade}
          </p>
        </div>

        {/* MTTR (Mean Time to Recovery) */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-500" />
              MTTR (Avg Recovery)
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {mttrHuman}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mean Time To Resolution</p>
        </div>

        {/* Active Outages */}
        <div className={`p-3.5 rounded-xl border ${
          activeOutages.length > 0
            ? 'bg-rose-500/10 border-rose-500/40 text-rose-500'
            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/50'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" />
              Active Outages
            </span>
          </div>
          <p className="text-2xl font-bold font-mono">
            {activeOutages.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeOutages.length === 0 ? 'All nodes normal' : 'Hosts currently DOWN'}
          </p>
        </div>

        {/* Total Resolved Incidents */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-500" />
              Total Logged Incidents
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {data?.totalIncidents || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Historical Outage Events</p>
        </div>
      </div>

      {/* Filter Tabs & Incident Log Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              All Events ({combinedList.length})
            </button>
            <button
              onClick={() => setFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === 'ACTIVE'
                  ? 'bg-rose-500 text-white shadow-sm font-semibold'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
            >
              Active Outages ({activeOutages.length})
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === 'RESOLVED'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Resolved ({history.length})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700/80">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Target Device</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Outage Start</th>
                <th className="py-2.5 px-3">Resolution Time</th>
                <th className="py-2.5 px-3">Downtime Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      {inc.isLive ? (
                        <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          Active Outage
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {inc.deviceName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {inc.deviceIp}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {new Date(inc.startTime).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {inc.endTime ? new Date(inc.endTime).toLocaleString() : 'Ongoing...'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {inc.isLive ? 'In progress' : inc.durationHuman}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60 mb-2" />
                    No network outages recorded in this filter view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
