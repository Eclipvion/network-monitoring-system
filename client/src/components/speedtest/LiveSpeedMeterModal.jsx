import React, { useState, useEffect } from 'react';
import { X, Play, RefreshCw, Gauge, Zap, AlertCircle, ShieldCheck } from 'lucide-react';
import SpeedometerGauge from './SpeedometerGauge';
import SpeedTestResultsCard from './SpeedTestResultsCard';
import SpeedTestHistoryList from './SpeedTestHistoryList';
import api from '../../services/api';

export default function LiveSpeedMeterModal({ isOpen, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState('IDLE'); // 'IDLE', 'PING', 'DOWNLOAD', 'UPLOAD', 'COMPLETE'
  const [gaugeValue, setGaugeValue] = useState(0);
  const [activeGaugeType, setActiveGaugeType] = useState('download'); // 'download' | 'upload'
  const [latestResult, setLatestResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  // Fetch initial speed test telemetry on open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await api.getSpeedTestTelemetry();
        if (mounted && res) {
          if (res.latest) setLatestResult(res.latest);
          if (res.history) setHistory(res.history);
          if (res.isRunning) setIsRunning(true);
        }
      } catch (err) {
        console.warn('Failed to fetch speed test data:', err);
      }
    };

    fetchTelemetry();
    return () => { mounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Run benchmark with realistic live gauge needle animation
  const handleRunSpeedTest = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    setPhase('PING');
    setActiveGaugeType('download');
    setGaugeValue(0);

    // Animate Needle smoothly across phases
    let animInterval = null;
    let targetSpeed = 45;

    // Phase 1: Ping & Jitter
    await new Promise((r) => setTimeout(r, 600));

    // Phase 2: Download Stream
    setPhase('DOWNLOAD');
    animInterval = setInterval(() => {
      setGaugeValue((prev) => {
        const delta = (targetSpeed - prev) * 0.25;
        const jitter = (Math.random() - 0.5) * 12;
        return Math.max(0, prev + delta + jitter);
      });
      // Gradually ramp target speed
      targetSpeed = Math.min(targetSpeed + 35, 320);
    }, 120);

    try {
      const res = await api.runLiveSpeedTest();
      clearInterval(animInterval);

      if (res && res.result) {
        // Phase 3: Upload quick check
        setPhase('UPLOAD');
        setActiveGaugeType('upload');
        setGaugeValue(res.result.uploadMbps);
        await new Promise((r) => setTimeout(r, 600));

        // Complete
        setPhase('COMPLETE');
        setActiveGaugeType('download');
        setGaugeValue(res.result.downloadMbps);
        setLatestResult(res.result);
        setHistory((prev) => [res.result, ...prev.slice(0, 19)]);
      } else {
        setPhase('IDLE');
        setGaugeValue(0);
      }
    } catch (err) {
      clearInterval(animInterval);
      setPhase('IDLE');
      setGaugeValue(0);
      setError(err.message || 'Speed test failed. Check connection.');
    } finally {
      setIsRunning(false);
    }
  };

  const phaseLabels = {
    IDLE: 'Ready for Benchmark',
    PING: 'Testing Ping & Latency Jitter...',
    DOWNLOAD: 'Measuring Edge Download Throughput...',
    UPLOAD: 'Measuring Edge Upload Speed...',
    COMPLETE: 'Speed Benchmark Completed!'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 px-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Gauge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Live Speedometer & ISP Benchmark
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase">
                  Edge CDN
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct Cloudflare Anycast edge latency, jitter & multi-megabit throughput test
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isRunning}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Speedometer Gauge Display */}
          <div className="flex flex-col items-center justify-center py-2 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-800/30 dark:to-transparent rounded-2xl border border-slate-100 dark:border-slate-800/60">
            <SpeedometerGauge
              value={gaugeValue}
              max={500}
              label={activeGaugeType === 'download' ? 'Download Speed' : 'Upload Speed'}
              unit="Mbps"
              isActive={isRunning}
              color={activeGaugeType === 'download' ? '#10b981' : '#06b6d4'}
            />

            {/* Test Phase Indicator */}
            <div className="mt-2 text-center">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                isRunning
                  ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 animate-pulse'
                  : phase === 'COMPLETE'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}>
                {phaseLabels[phase]}
              </span>
            </div>

            {/* Run Button */}
            <div className="mt-4">
              <button
                onClick={handleRunSpeedTest}
                disabled={isRunning}
                className="px-6 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Measuring Bandwidth...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Run Live Speed Benchmark
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Card */}
          {latestResult && <SpeedTestResultsCard result={latestResult} />}

          {/* History List */}
          <SpeedTestHistoryList history={history} />
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Zero-overhead non-blocking edge telemetry
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
