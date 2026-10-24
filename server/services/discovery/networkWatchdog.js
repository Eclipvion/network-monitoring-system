import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import arpScanner from './arpScanner.js';
import dataStore from '../dataStore.js';
import { broadcastDeviceStatus } from '../../websocket/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const eventsFilePath = path.resolve(__dirname, '../../../data/discovery_events.json');

// In-Memory state
let watchdogTimer = null;
let isScanning = false;
let autoAddEnabled = true;
let scanIntervalSeconds = 60; // 60s default
let lastScanTime = null;
let activeTopologyIps = new Set();
let recentEvents = [];

// Initialize discovery events file if needed
try {
  if (fs.existsSync(eventsFilePath)) {
    const raw = fs.readFileSync(eventsFilePath, 'utf8');
    recentEvents = JSON.parse(raw);
  } else {
    fs.writeFileSync(eventsFilePath, JSON.stringify([], null, 2));
  }
} catch (e) {
  recentEvents = [];
}

function saveEvents() {
  try {
    fs.writeFileSync(eventsFilePath, JSON.stringify(recentEvents.slice(0, 100), null, 2));
  } catch (e) {
    console.error('Failed to save discovery events:', e);
  }
}

function logEvent(type, device, note) {
  const event = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type, // 'JOINED' | 'DISCONNECTED'
    ip: device.ip,
    name: device.name || `${device.vendor || 'Host'} (${device.ip})`,
    vendor: device.vendor || 'Network Device',
    typeCategory: device.type || 'workstation',
    note: note || '',
    timestamp: new Date().toISOString()
  };

  recentEvents.unshift(event);
  if (recentEvents.length > 100) recentEvents.pop();
  saveEvents();

  return event;
}

/**
 * Core Sweep Execution
 */
export async function runWatchdogSweep() {
  if (isScanning) return;
  isScanning = true;

  try {
    const scanData = await arpScanner.scanLocalNeighbors();
    const discovered = scanData.devices || [];
    const discoveredIps = new Set(discovered.map((d) => d.ip));

    const existingDevices = await dataStore.getDevices();
    const existingIpMap = new Map(existingDevices.map((d) => [d.ip.toLowerCase(), d]));

    // 1. Detect and Auto-Add New Devices
    for (const dev of discovered) {
      const isAlreadyAdded = existingIpMap.has(dev.ip.toLowerCase());

      if (!isAlreadyAdded && autoAddEnabled) {
        const deviceName = dev.hostname 
          ? dev.hostname 
          : `${dev.vendor || 'LAN Device'} (${dev.ip})`;

        const newDeviceData = {
          name: deviceName,
          ip: dev.ip,
          type: dev.type || 'workstation',
          group: 'Local Network',
          monitoring: true,
          interval: 15,
          autoDiscovered: true
        };

        const added = await dataStore.addDevice(newDeviceData);
        existingIpMap.set(dev.ip.toLowerCase(), added);

        logEvent('JOINED', added, 'Auto-detected & added to Monitoring and Topology');
        console.log(`[NetworkWatchdog] 🟢 NEW DEVICE AUTO-ADDED: ${deviceName} [${dev.ip}]`);
      }
    }

    // 2. Track Disconnected Devices (Present in activeTopologyIps previously, but missing in current scan)
    for (const prevIp of activeTopologyIps) {
      if (!discoveredIps.has(prevIp)) {
        const dev = existingIpMap.get(prevIp.toLowerCase());
        if (dev) {
          logEvent('DISCONNECTED', dev, 'Device left Wi-Fi network (Removed from Topology, kept in Monitoring)');
          console.log(`[NetworkWatchdog] ⚪ DEVICE DISCONNECTED: ${dev.name} [${dev.ip}] - Removed from Topology only`);
        }
      }
    }

    // 3. Update the live active Topology IP set
    activeTopologyIps = discoveredIps;
    lastScanTime = new Date().toISOString();

  } catch (err) {
    console.error('[NetworkWatchdog] Sweep error:', err.message);
  } finally {
    isScanning = false;
  }
}

/**
 * Start the recurring background watchdog
 */
export function startNetworkWatchdog(intervalSec = 60) {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
  }

  scanIntervalSeconds = intervalSec;
  console.log(`[NetworkWatchdog] 🚀 Background Device Watchdog active (Every ${scanIntervalSeconds}s)`);

  // First run after 2 seconds
  setTimeout(runWatchdogSweep, 2000);

  // Then recurring
  watchdogTimer = setInterval(runWatchdogSweep, scanIntervalSeconds * 1000);
}

export function stopNetworkWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    console.log('[NetworkWatchdog] Stopped');
  }
}

export function getWatchdogStatus() {
  return {
    isRunning: Boolean(watchdogTimer),
    autoAddEnabled,
    intervalSeconds: scanIntervalSeconds,
    lastScanTime,
    activeConnectedCount: activeTopologyIps.size,
    activeConnectedIps: Array.from(activeTopologyIps),
    recentEvents: recentEvents.slice(0, 30)
  };
}

export function setWatchdogConfig({ enabled, interval }) {
  if (typeof enabled === 'boolean') {
    autoAddEnabled = enabled;
  }
  if (interval && Number(interval) >= 30) {
    startNetworkWatchdog(Number(interval));
  }
  return getWatchdogStatus();
}

/**
 * Check if an IP is currently connected to active topology
 */
export function isIpConnectedToTopology(ip) {
  if (!ip) return false;
  // If it's a cloud endpoint or public IP, it remains in topology as long as it's not local
  const clean = String(ip).split(':')[0].trim().toLowerCase();
  const isLocal = clean.startsWith('192.168.') || clean.startsWith('10.') || clean === '127.0.0.1' || clean === 'localhost';
  if (!isLocal) return true; // Cloud endpoints stay connected

  return activeTopologyIps.has(clean);
}

export default {
  startNetworkWatchdog,
  stopNetworkWatchdog,
  runWatchdogSweep,
  getWatchdogStatus,
  setWatchdogConfig,
  isIpConnectedToTopology
};
