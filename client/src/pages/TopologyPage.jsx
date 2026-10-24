import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Network,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Layers,
  Activity,
  CheckCircle2,
  EyeOff,
  Eye,
  Grid,
  FolderTree,
  Compass,
  Focus
} from 'lucide-react';
import WatchdogStatusBar from '../components/topology/WatchdogStatusBar';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import TopologyInspector from '../components/topology/TopologyInspector';
import api from '../services/api';

export default function TopologyPage({ devices = [], onRefreshDevices, onOpenDetails }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useState('tree'); // 'tree' | 'grouped' | 'radial'
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [watchdogStatus, setWatchdogStatus] = useState(null);
  const [showDisconnected, setShowDisconnected] = useState(false);

  // Single atomic viewport transform state (prevents React render de-sync and jitter)
  const [viewport, setViewport] = useState({
    x: 0,
    y: 40,
    zoom: 0.75
  });

  const containerRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // Fetch local gateway and watchdog info
  const loadNetworkData = async () => {
    try {
      const [info, wStatus] = await Promise.all([
        api.getNetworkInfo(),
        api.getWatchdogStatus()
      ]);
      setNetworkInfo(info);
      setWatchdogStatus(wStatus);
    } catch (e) {
      console.error('Failed to load topology network data:', e);
    }
  };

  useEffect(() => {
    loadNetworkData();
    const interval = setInterval(async () => {
      try {
        const wStatus = await api.getWatchdogStatus();
        setWatchdogStatus(wStatus);
      } catch (e) {}
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Build Topology Layout (Unified Network Model - Core Router at top, devices below)
  const { allNodes, links, tierBanners, stats, disconnectedCount, canvasDimensions } = useMemo(() => {
    const gatewayIp = networkInfo?.startIp || '192.168.46.1';
    const activeIps = new Set((watchdogStatus?.activeConnectedIps || []).map(ip => ip.toLowerCase()));

    // Link gateway node to actual database device
    const existingGw = devices.find(d => 
      d.ip === gatewayIp || 
      d.type === 'gateway' || 
      d.type === 'router' || 
      d.ip === '192.168.46.1'
    );

    const gatewayNode = {
      id: existingGw ? existingGw.id : 'gateway_core',
      deviceId: existingGw ? existingGw.id : (devices[0]?.id || 1),
      isGateway: true,
      name: existingGw?.name || 'Main Gateway / Core Router',
      ip: gatewayIp,
      type: 'gateway',
      status: existingGw?.status || 'UP',
      latency: existingGw?.latestResult?.latency || 1,
      group: 'Core Infrastructure'
    };

    let disconnectedCount = 0;

    // Filter active connected devices
    let filteredDevices = devices.filter((d) => {
      if (d.ip === gatewayIp || (existingGw && d.id === existingGw.id)) {
        return false;
      }

      const cleanIp = String(d.ip).split(':')[0].trim().toLowerCase();
      const isCurrentlyConnected = activeIps.has(cleanIp) || d.status === 'UP';

      if (!isCurrentlyConnected) {
        disconnectedCount++;
        if (!showDisconnected) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = String(d.name || '').toLowerCase().includes(term);
        const matchIp = String(d.ip || '').toLowerCase().includes(term);
        const matchType = String(d.type || '').toLowerCase().includes(term);
        if (!matchName && !matchIp && !matchType) return false;
      }

      return true;
    });

    const totalCount = filteredDevices.length + 1; // +1 gateway
    const onlineCount = (filteredDevices.filter((d) => d.status === 'UP').length) + 1;
    const downCount = filteredDevices.filter((d) => d.status === 'DOWN').length;

    let validLatencies = filteredDevices.map(d => d.latestResult?.latency).filter(l => typeof l === 'number');
    const avgLatency = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : 12;

    const statsObj = { totalCount, onlineCount, downCount, avgLatency };

    let computedNodes = [];
    let computedLinks = [];
    let computedBanners = [];

    // Spacing: Card width 195px + 35px gap = 230px. Height 95px + 45px gap = 140px.
    const PITCH_X = 230;
    const PITCH_Y = 140;

    // Widescreen 8-9 column grid (prevents canvas from becoming excessively tall)
    const cols = Math.min(9, Math.max(5, Math.ceil(Math.sqrt(filteredDevices.length * 1.8))));
    const rows = Math.ceil(filteredDevices.length / cols) || 1;

    let canvasWidth = Math.max(1800, (cols + 1) * PITCH_X + 160);
    const cx = canvasWidth / 2;

    let canvasHeight = 1000;

    // ==========================================
    // LAYOUT MODE 1: MATRIX GRID TREE (Default)
    // ==========================================
    if (layoutMode === 'tree') {
      const gwY = 95;
      const startY = 240;

      canvasHeight = Math.max(900, startY + (rows * PITCH_Y) + 120);

      // 1. Gateway at top center
      const gwPlaced = { ...gatewayNode, x: cx, y: gwY };

      // 2. Devices placed in centered rows
      const placedDevices = [];
      for (let r = 0; r < rows; r++) {
        const startIdx = r * cols;
        const endIdx = Math.min(startIdx + cols, filteredDevices.length);
        const countInRow = endIdx - startIdx;
        const rowWidth = (countInRow - 1) * PITCH_X;
        const rowStartX = cx - (rowWidth / 2);

        for (let c = 0; c < countInRow; c++) {
          const d = filteredDevices[startIdx + c];
          placedDevices.push({
            ...d,
            x: rowStartX + c * PITCH_X,
            y: startY + r * PITCH_Y
          });
        }
      }

      computedNodes = [gwPlaced, ...placedDevices];

      placedDevices.forEach((target) => {
        computedLinks.push({
          source: gwPlaced,
          target,
          status: target.status,
          latency: target.latestResult?.latency || 10
        });
      });

    // ==========================================
    // LAYOUT MODE 2: GROUPED BY DEVICE TYPE
    // ==========================================
    } else if (layoutMode === 'grouped') {
      const workstations = filteredDevices.filter((d) => {
        const t = String(d.type || '').toLowerCase();
        return t.includes('workstation') || t.includes('pc') || t.includes('laptop') || t.includes('desktop');
      });

      const mobileDevices = filteredDevices.filter((d) => {
        const t = String(d.type || '').toLowerCase();
        const n = String(d.name || '').toLowerCase();
        return t.includes('mobile') || t.includes('phone') || t.includes('tablet') || n.includes('mobile') || n.includes('private wi-fi');
      });

      const assignedIds = new Set([...workstations.map(d => d.id), ...mobileDevices.map(d => d.id)]);
      const otherDevices = filteredDevices.filter((d) => !assignedIds.has(d.id));

      const groupCols = 8;
      canvasWidth = Math.max(1800, (groupCols + 1) * PITCH_X + 160);
      const groupCx = canvasWidth / 2;

      let currentY = 90;

      // Gateway at top
      const gwPlaced = { ...gatewayNode, x: groupCx, y: currentY };
      currentY += 150;

      const placeGroup = (items, label, icon) => {
        if (items.length === 0) return [];
        computedBanners.push({
          y: currentY - 35,
          label,
          count: `${items.length} Devices`,
          icon
        });

        const placed = [];
        const groupRows = Math.ceil(items.length / groupCols);
        for (let r = 0; r < groupRows; r++) {
          const startIdx = r * groupCols;
          const endIdx = Math.min(startIdx + groupCols, items.length);
          const countInRow = endIdx - startIdx;
          const rowWidth = (countInRow - 1) * PITCH_X;
          const rowStartX = groupCx - (rowWidth / 2);

          for (let c = 0; c < countInRow; c++) {
            const d = items[startIdx + c];
            placed.push({
              ...d,
              x: rowStartX + c * PITCH_X,
              y: currentY + r * PITCH_Y
            });
          }
        }
        currentY += groupRows * PITCH_Y + 50;
        return placed;
      };

      const placedWorkstations = placeGroup(workstations, 'Computers & Workstations', '💻');
      const placedMobile = placeGroup(mobileDevices, 'Mobile & Wireless Clients', '📱');
      const placedOther = placeGroup(otherDevices, 'Network Infrastructure & Other Devices', '🖨️');

      canvasHeight = Math.max(900, currentY + 80);

      const allPlaced = [...placedWorkstations, ...placedMobile, ...placedOther];
      computedNodes = [gwPlaced, ...allPlaced];

      allPlaced.forEach((target) => {
        computedLinks.push({
          source: gwPlaced,
          target,
          status: target.status,
          latency: target.latestResult?.latency || 10
        });
      });

    // ==========================================
    // LAYOUT MODE 3: CONCENTRIC RADIAL ORBIT
    // ==========================================
    } else {
      let maxRadius = 400;
      if (filteredDevices.length > 36) maxRadius = 880;
      else if (filteredDevices.length > 20) maxRadius = 660;
      else if (filteredDevices.length > 10) maxRadius = 480;

      canvasWidth = Math.max(1800, maxRadius * 2 + 500);
      canvasHeight = Math.max(1800, maxRadius * 2 + 500);
      const radCx = canvasWidth / 2;
      const radCy = canvasHeight / 2;

      const gwPlaced = { ...gatewayNode, x: radCx, y: radCy };
      computedNodes.push(gwPlaced);

      const rings = [];
      if (filteredDevices.length <= 12) {
        rings.push({ radius: 300, items: filteredDevices });
      } else if (filteredDevices.length <= 28) {
        rings.push({ radius: 280, items: filteredDevices.slice(0, 10) });
        rings.push({ radius: 500, items: filteredDevices.slice(10) });
      } else if (filteredDevices.length <= 50) {
        rings.push({ radius: 280, items: filteredDevices.slice(0, 8) });
        rings.push({ radius: 480, items: filteredDevices.slice(8, 24) });
        rings.push({ radius: 680, items: filteredDevices.slice(24) });
      } else {
        rings.push({ radius: 280, items: filteredDevices.slice(0, 8) });
        rings.push({ radius: 460, items: filteredDevices.slice(8, 22) });
        rings.push({ radius: 660, items: filteredDevices.slice(22, 42) });
        rings.push({ radius: 880, items: filteredDevices.slice(42) });
      }

      rings.forEach((ring, ringIdx) => {
        const count = ring.items.length;
        ring.items.forEach((d, i) => {
          const angle = (2 * Math.PI * i) / (count || 1) - Math.PI / 2 + (ringIdx * 0.15);
          const nx = radCx + ring.radius * Math.cos(angle);
          const ny = radCy + ring.radius * Math.sin(angle);
          const nodeObj = { ...d, x: nx, y: ny };
          computedNodes.push(nodeObj);
          computedLinks.push({
            source: gwPlaced,
            target: nodeObj,
            status: d.status,
            latency: d.latestResult?.latency || 12
          });
        });
      });
    }

    return {
      allNodes: computedNodes,
      links: computedLinks,
      tierBanners: computedBanners,
      stats: statsObj,
      disconnectedCount,
      canvasDimensions: { width: canvasWidth, height: canvasHeight }
    };
  }, [devices, networkInfo, watchdogStatus, layoutMode, showDisconnected, searchTerm]);

  // Initial Placement on Mount: Center the Gateway at comfortable 75% zoom (NOT microscopic 30%!)
  useEffect(() => {
    if (!hasInitializedRef.current && allNodes.length > 0) {
      hasInitializedRef.current = true;
      const container = containerRef.current;
      if (container) {
        const clientWidth = container.clientWidth || 1000;
        const canvasW = canvasDimensions.width;
        // Center canvas horizontally, position top with 40px margin
        const initialPanX = Math.round((clientWidth - canvasW * 0.75) / 2);
        setViewport({
          x: initialPanX,
          y: 40,
          zoom: 0.75
        });
      }
    }
  }, [allNodes.length, canvasDimensions.width]);

  // Fit to screen helper - calculates full bounding box fit
  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container || allNodes.length === 0) return;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;
    if (!clientWidth || !clientHeight) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allNodes.forEach((n) => {
      minX = Math.min(minX, n.x - 110);
      maxX = Math.max(maxX, n.x + 110);
      minY = Math.min(minY, n.y - 70);
      maxY = Math.max(maxY, n.y + 70);
    });

    const bboxW = Math.max(400, maxX - minX);
    const bboxH = Math.max(300, maxY - minY);

    const padding = 50;
    const scaleX = (clientWidth - padding * 2) / bboxW;
    const scaleY = (clientHeight - padding * 2) / bboxH;
    // Minimum 45% zoom so cards are always readable
    const targetZoom = Math.min(1.0, Math.max(0.45, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const panX = clientWidth / 2 - centerX * targetZoom;
    const panY = clientHeight / 2 - centerY * targetZoom;

    setViewport({
      x: Math.round(panX),
      y: Math.round(panY),
      zoom: Number(targetZoom.toFixed(2))
    });
  }, [allNodes]);

  // Layout mode switcher
  const handleLayoutChange = (mode) => {
    setLayoutMode(mode);
    setTimeout(fitToScreen, 60);
  };

  // Direct Button Zoom (+ / -) towards center of viewport
  const handleZoomStep = (stepFactor) => {
    const container = containerRef.current;
    if (!container) return;
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    setViewport((prev) => {
      const nextZoom = Math.min(1.8, Math.max(0.4, Number((prev.zoom * stepFactor).toFixed(2))));
      if (Math.abs(nextZoom - prev.zoom) < 0.001) return prev;

      const worldX = (centerX - prev.x) / prev.zoom;
      const worldY = (centerY - prev.y) / prev.zoom;

      const nextX = centerX - worldX * nextZoom;
      const nextY = centerY - worldY * nextZoom;

      return {
        x: Math.round(nextX),
        y: Math.round(nextY),
        zoom: nextZoom
      };
    });
  };

  // Interactive Zoom Slider Handler
  const handleSliderZoom = (percentValue) => {
    const container = containerRef.current;
    if (!container) return;
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    const targetZoom = Math.min(1.8, Math.max(0.4, Number((percentValue / 100).toFixed(2))));

    setViewport((prev) => {
      if (Math.abs(targetZoom - prev.zoom) < 0.001) return prev;

      const worldX = (centerX - prev.x) / prev.zoom;
      const worldY = (centerY - prev.y) / prev.zoom;

      const nextX = centerX - worldX * targetZoom;
      const nextY = centerY - worldY * targetZoom;

      return {
        x: Math.round(nextX),
        y: Math.round(nextY),
        zoom: targetZoom
      };
    });
  };

  // 100% Reset Button
  const handleReset100 = () => {
    const container = containerRef.current;
    if (!container) return;
    const clientWidth = container.clientWidth;
    const canvasW = canvasDimensions.width;
    const initialPanX = Math.round((clientWidth - canvasW * 1.0) / 2);

    setViewport({
      x: initialPanX,
      y: 40,
      zoom: 1.0
    });
  };

  // Controlled, Non-Runaway Mouse Wheel Zoom (Gentle 8% step per wheel notch)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      // Gentle fixed step: scroll up = +8% zoom, scroll down = -8% zoom
      const stepFactor = e.deltaY < 0 ? 1.08 : 0.92;

      setViewport((prev) => {
        const nextZoom = Math.min(1.8, Math.max(0.4, Number((prev.zoom * stepFactor).toFixed(3))));
        if (Math.abs(nextZoom - prev.zoom) < 0.001) return prev;

        const worldX = (pointerX - prev.x) / prev.zoom;
        const worldY = (pointerY - prev.y) / prev.zoom;

        const nextX = pointerX - worldX * nextZoom;
        const nextY = pointerY - worldY * nextZoom;

        return {
          x: Math.round(nextX),
          y: Math.round(nextY),
          zoom: nextZoom
        };
      });
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return allNodes.find((n) => String(n.id) === String(selectedNodeId)) || null;
  }, [selectedNodeId, allNodes]);

  return (
    <div className="space-y-3.5">
      {/* 1. Live Device Watchdog Ribbon */}
      <WatchdogStatusBar
        watchdogStatus={watchdogStatus}
        onRefreshTopology={onRefreshDevices}
        onWatchdogUpdated={(newStatus) => setWatchdogStatus(newStatus)}
      />

      {/* 2. Top Header & Telemetry KPI Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Network className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Live Network Topology Map
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Connected Network Hosts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hover any device for live diagnostics • Drag canvas to pan • Use zoom slider or wheel
            </p>
          </div>
        </div>

        {/* Live KPIs */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">On Map:</span>
            <span className="font-bold font-mono text-slate-800 dark:text-white">{stats.totalCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-medium">Online:</span>
            <span className="font-bold font-mono">{stats.onlineCount}</span>
          </div>

          {disconnectedCount > 0 && (
            <button
              onClick={() => setShowDisconnected(!showDisconnected)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all ${
                showDisconnected
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Click to toggle display of disconnected devices on map"
            >
              {showDisconnected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{disconnectedCount} Disconnected (Hidden)</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-teal-500" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Avg Latency:</span>
            <span className="font-bold font-mono text-slate-800 dark:text-white">{stats.avgLatency}ms</span>
          </div>

          <button
            onClick={() => {
              loadNetworkData();
              if (onRefreshDevices) onRefreshDevices();
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh All Node Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by name, IP, vendor, type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Layout Switcher & Visual Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Layout Mode Toggles */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => handleLayoutChange('tree')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                layoutMode === 'tree'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              title="Matrix Grid Tree (Zero Overlap)"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Matrix Grid</span>
            </button>

            <button
              onClick={() => handleLayoutChange('grouped')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                layoutMode === 'grouped'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              title="Grouped by Device Type (Workstations, Mobile, Other)"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Grouped Tiers</span>
            </button>

            <button
              onClick={() => handleLayoutChange('radial')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                layoutMode === 'radial'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              title="Concentric Multi-Ring Orbit"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Concentric Orbit</span>
            </button>
          </div>

          {/* Interactive Zoom Controls with Slider */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-2">
            <button
              onClick={fitToScreen}
              className="px-2 py-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 transition-colors"
              title="Fit all devices on screen"
            >
              <Focus className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px]">Fit View</span>
            </button>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <button
              onClick={() => handleZoomStep(0.9)}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {/* Visual Zoom Slider */}
            <input
              type="range"
              min="40"
              max="180"
              step="5"
              value={Math.round(viewport.zoom * 100)}
              onChange={(e) => handleSliderZoom(Number(e.target.value))}
              className="w-20 sm:w-24 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              title="Slide to adjust zoom"
            />

            <span className="font-mono text-[11px] px-1 text-slate-600 dark:text-slate-300 min-w-[38px] text-center font-semibold">
              {Math.round(viewport.zoom * 100)}%
            </span>

            <button
              onClick={() => handleZoomStep(1.1)}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleReset100}
              className="px-1.5 py-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold transition-colors"
              title="Reset 100% Zoom"
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Interactive Canvas & Floating Inspector */}
      <div className="relative w-full h-[680px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden shadow-inner">
        <TopologyCanvas
          nodes={allNodes}
          links={links}
          tierBanners={tierBanners}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => setSelectedNodeId(id)}
          layoutMode={layoutMode}
          viewport={viewport}
          setViewport={setViewport}
          canvasWidth={canvasDimensions.width}
          canvasHeight={canvasDimensions.height}
          searchTerm={searchTerm}
          containerRef={containerRef}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-[11px] space-y-1.5 text-slate-400 pointer-events-auto shadow-xl">
          <div className="font-semibold text-slate-200 text-xs mb-1">Topology Legend</div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Active Host (Green = Low Latency)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Warning Host (&gt;80ms latency)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Offline Host (Visible if toggled)</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
            <span>Laser Pulse = Live traffic flow</span>
          </div>
        </div>

        {/* Top-Left Hint */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-slate-400 text-xs flex items-center gap-2 shadow-lg pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Hover device for instant specs • Drag canvas to pan • Use zoom slider or wheel</span>
        </div>

        {/* Floating Side Inspector */}
        <TopologyInspector
          selectedNode={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onOpenDetails={onOpenDetails}
          onPingCompleted={onRefreshDevices}
        />
      </div>
    </div>
  );
}
