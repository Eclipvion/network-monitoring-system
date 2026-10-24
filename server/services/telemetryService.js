import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { broadcastBandwidth } from '../websocket/socketHandler.js';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outagesFilePath = path.resolve(__dirname, '../../data/outages.json');

// Ensure outages file exists
if (!fs.existsSync(outagesFilePath)) {
  try {
    fs.writeFileSync(outagesFilePath, JSON.stringify({ activeOutages: {}, history: [] }, null, 2));
  } catch (e) {
    console.error('Failed to init outages.json:', e);
  }
}

// In-Memory Rolling Bandwidth Buffer
let lastBytesSample = null;
let currentBandwidth = {
  downloadKbps: 0,
  uploadKbps: 0,
  downloadMbps: 0,
  uploadMbps: 0,
  totalRxMb: 0,
  totalTxMb: 0,
  peakDownloadKbps: 0,
  peakUploadKbps: 0,
  timestamp: new Date().toISOString()
};

const MAX_HISTORY = 40;
const bandwidthHistory = [];

/**
 * Poll network interface stats via native Windows netstat -e
 */
async function sampleInterfaceStats() {
  try {
    const isWindows = process.platform === 'win32';
    if (!isWindows) {
      // Fallback for non-windows
      return;
    }

    const { stdout } = await execPromise('netstat -e', { timeout: 1500 });
    const match = stdout.match(/Bytes\s+(\d+)\s+(\d+)/i);
    if (!match) return;

    const rx = parseInt(match[1], 10);
    const tx = parseInt(match[2], 10);
    const now = Date.now();

    if (lastBytesSample) {
      const dtSec = Math.max((now - lastBytesSample.timestamp) / 1000, 0.5);
      const deltaRx = Math.max(rx - lastBytesSample.rx, 0);
      const deltaTx = Math.max(tx - lastBytesSample.tx, 0);

      const downKb = parseFloat((deltaRx / 1024 / dtSec).toFixed(1));
      const upKb = parseFloat((deltaTx / 1024 / dtSec).toFixed(1));
      const downMb = parseFloat((downKb / 1024).toFixed(2));
      const upMb = parseFloat((upKb / 1024).toFixed(2));

      currentBandwidth = {
        downloadKbps: downKb,
        uploadKbps: upKb,
        downloadMbps: downMb,
        uploadMbps: upMb,
        totalRxMb: parseFloat((rx / 1024 / 1024).toFixed(1)),
        totalTxMb: parseFloat((tx / 1024 / 1024).toFixed(1)),
        peakDownloadKbps: Math.max(currentBandwidth.peakDownloadKbps || 0, downKb),
        peakUploadKbps: Math.max(currentBandwidth.peakUploadKbps || 0, upKb),
        timestamp: new Date().toISOString()
      };

      bandwidthHistory.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        download: downKb,
        upload: upKb
      });

      if (bandwidthHistory.length > MAX_HISTORY) {
        bandwidthHistory.shift();
      }

      // Broadcast real-time telemetry frame over WebSockets
      broadcastBandwidth({
        current: currentBandwidth,
        history: bandwidthHistory
      });
    }

    lastBytesSample = { rx, tx, timestamp: now };
  } catch (err) {
    // Ignore transient poll error
  }
}

// Start continuous 1-second real-time sampling
let bandwidthTimer = null;
export function startTelemetryCollector() {
  if (bandwidthTimer) return;
  sampleInterfaceStats();
  bandwidthTimer = setInterval(sampleInterfaceStats, 1000);
}

export function getLiveBandwidth() {
  return {
    current: currentBandwidth,
    history: bandwidthHistory
  };
}

// -------------------------------------------------------------
// Outage & SLA Engine
// -------------------------------------------------------------
function readOutagesData() {
  try {
    if (fs.existsSync(outagesFilePath)) {
      const content = fs.readFileSync(outagesFilePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading outages.json:', e);
  }
  return { activeOutages: {}, history: [] };
}

function writeOutagesData(data) {
  try {
    fs.writeFileSync(outagesFilePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error writing outages.json:', e);
  }
}

export function handleDeviceOutageEvent(device, status) {
  const data = readOutagesData();
  const devId = String(device.id);
  const now = new Date().toISOString();

  if (status === 'DOWN') {
    // Check if not already in activeOutages
    if (!data.activeOutages[devId]) {
      data.activeOutages[devId] = {
        id: `outage_${Date.now()}_${devId}`,
        deviceId: device.id,
        deviceName: device.name,
        deviceIp: device.ip,
        startTime: now,
        status: 'ACTIVE'
      };
      writeOutagesData(data);
    }
  } else if (status === 'UP') {
    // If was active outage, resolve it
    if (data.activeOutages[devId]) {
      const active = data.activeOutages[devId];
      const startMs = new Date(active.startTime).getTime();
      const endMs = new Date(now).getTime();
      const durationSeconds = Math.max(Math.round((endMs - startMs) / 1000), 1);

      const resolvedRecord = {
        ...active,
        endTime: now,
        durationSeconds,
        durationHuman: formatDuration(durationSeconds),
        status: 'RESOLVED'
      };

      // Add to front of history
      data.history.unshift(resolvedRecord);
      if (data.history.length > 200) data.history.pop();

      delete data.activeOutages[devId];
      writeOutagesData(data);
    }
  }
}

function formatDuration(sec) {
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainSec = sec % 60;
  if (mins < 60) return `${mins}m ${remainSec}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

export function getOutageAndSlaStats() {
  const data = readOutagesData();
  const history = data.history || [];
  const activeList = Object.values(data.activeOutages || {});

  // Compute MTTR (Mean Time To Recovery) on resolved outages
  let totalDowntimeSec = 0;
  history.forEach((h) => {
    totalDowntimeSec += (h.durationSeconds || 0);
  });

  const mttrSec = history.length > 0 ? Math.round(totalDowntimeSec / history.length) : 0;
  const mttrHuman = history.length > 0 ? formatDuration(mttrSec) : '0s';

  // Compute SLA Uptime %
  // Total monitored window: 24h = 86400 seconds * devices count (approx)
  // Standard SLA calculation based on total incident downtime
  const baselineWindowSec = 86400; // 24 hours
  const downtimeRatio = Math.min(totalDowntimeSec / (baselineWindowSec * 10), 0.1); // max 10% penalty
  const slaPercentage = parseFloat(((1 - downtimeRatio) * 100).toFixed(2));

  return {
    activeOutages: activeList,
    history: history.slice(0, 50),
    totalIncidents: history.length + activeList.length,
    activeIncidentsCount: activeList.length,
    mttrSeconds: mttrSec,
    mttrHuman,
    slaPercentage: isNaN(slaPercentage) ? 99.9 : Math.max(slaPercentage, 95.0),
    slaGrade: slaPercentage >= 99.9 ? 'A+ Elite (99.9%)' : slaPercentage >= 99.0 ? 'A Tier (99.0%)' : 'SLA Warning (<99%)'
  };
}

export default {
  startTelemetryCollector,
  getLiveBandwidth,
  handleDeviceOutageEvent,
  getOutageAndSlaStats
};
