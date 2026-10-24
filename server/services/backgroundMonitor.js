import { execFile } from 'child_process';
import net from 'net';
import dataStore from './dataStore.js';
import telemetryService from './telemetryService.js';
import { probeHostLive } from '../routes/deviceRoutes.js';
import {
  broadcastDeviceStatus,
  broadcastNewAlert,
  broadcastAlertResolved
} from '../websocket/socketHandler.js';

let isRunning = false;
let monitorIntervalId = null;

// Anti-flapping counter: require 2 consecutive failed probes before flipping a host DOWN
const consecutiveFailures = new Map();

/**
 * Ping an individual target (IPv4 or hostname).
 * Returns { status: 'UP'|'DOWN'|'WARNING', latency: number|null, packetLoss: number, message: string }
 */
function pingTarget(rawHost) {
  return new Promise((resolve) => {
    const host = (rawHost || '').trim();
    if (!host) {
      return resolve({ status: 'DOWN', latency: null, packetLoss: 100, message: 'Invalid host' });
    }

    const isWindows = process.platform === 'win32';
    const pingCmd = 'ping';
    // 1 probe, 1000ms timeout for rapid responsiveness
    const pingArgs = isWindows
      ? ['-4', '-n', '1', '-w', '1000', host]
      : ['-c', '1', '-W', '1', host];

    execFile(pingCmd, pingArgs, { timeout: 2000 }, (err, stdout) => {
      const latencyMatch = stdout ? stdout.match(/time[=<]\s*([0-9.]+)\s*ms/i) : null;

      if (!err && latencyMatch) {
        const latency = parseFloat(latencyMatch[1]);
        const status = latency > 150 ? 'WARNING' : 'UP';
        return resolve({
          status,
          latency,
          packetLoss: 0,
          message: `OK: ${latency}ms, 0% loss`
        });
      }

      // If ping command returned 0 but latency parser didn't match (e.g. "<1ms")
      if (!err && stdout && (stdout.includes('Reply from') || stdout.includes('bytes from'))) {
        return resolve({
          status: 'UP',
          latency: 1.0,
          packetLoss: 0,
          message: 'OK: <1ms, 0% loss'
        });
      }

      // Fallback TCP 80 / 443 check for web hosts
      const isDomainOrIpWithPort = host.includes('.') || host.includes(':');
      if (isDomainOrIpWithPort) {
        const start = Date.now();
        const testPort = host.includes(':') ? parseInt(host.split(':')[1], 10) : 80;
        const cleanHost = host.includes(':') ? host.split(':')[0] : host;

        const sock = new net.Socket();
        sock.setTimeout(1200);

        let resolved = false;
        const cleanupAndResolve = (result) => {
          if (resolved) return;
          resolved = true;
          sock.destroy();
          resolve(result);
        };

        sock.connect(testPort, cleanHost, () => {
          const lat = Date.now() - start;
          cleanupAndResolve({
            status: lat > 150 ? 'WARNING' : 'UP',
            latency: lat,
            packetLoss: 0,
            message: `OK (TCP ${testPort}): ${lat}ms, 0% loss`
          });
        });

        sock.on('error', () => {
          cleanupAndResolve({
            status: 'DOWN',
            latency: null,
            packetLoss: 100,
            message: 'Ping failed: Destination Host Unreachable'
          });
        });

        sock.on('timeout', () => {
          cleanupAndResolve({
            status: 'DOWN',
            latency: null,
            packetLoss: 100,
            message: 'Ping timeout: Request Timed Out'
          });
        });

        return;
      }

      resolve({
        status: 'DOWN',
        latency: null,
        packetLoss: 100,
        message: 'Ping failed: Destination Host Unreachable'
      });
    });
  });
}

/**
 * Execute a single monitoring sweep of all active devices.
 */
async function runMonitoringSweep() {
  if (isRunning) return;
  isRunning = true;

  try {
    const devices = await dataStore.getDevices();
    const monitoredDevices = devices.filter((d) => d.monitoring !== false);

    if (monitoredDevices.length === 0) {
      isRunning = false;
      return;
    }

    // Process devices in parallel chunks of 10
    const chunkSize = 10;
    for (let i = 0; i < monitoredDevices.length; i += chunkSize) {
      const chunk = monitoredDevices.slice(i, i + chunkSize);

      await Promise.allSettled(
        chunk.map(async (device) => {
          try {
            const devId = Number(device.id);
            const probe = await probeHostLive(device.ip);
            let finalStatus = probe.status || 'DOWN';
            let packetLoss = finalStatus === 'UP' ? 0 : finalStatus === 'WARNING' ? 25 : 100;

            if (finalStatus === 'DOWN') {
              const currentFailures = (consecutiveFailures.get(devId) || 0) + 1;
              consecutiveFailures.set(devId, currentFailures);

              // Anti-flapping: require 2 consecutive misses before flipping a healthy host DOWN
              const prev = dataStore.getDeviceLatestStatus(devId);
              const wasUp = prev ? (prev.status === 'UP' || prev.status === 'WARNING') : true;
              if (currentFailures < 2 && wasUp) {
                finalStatus = 'WARNING';
                packetLoss = 50;
              }
            } else {
              consecutiveFailures.delete(devId);
            }

            const timestamp = new Date().toISOString();

            // Track Outage & SLA state transitions
            telemetryService.handleDeviceOutageEvent(device, finalStatus);

            const { result, newAlert, resolvedAlerts } = await dataStore.saveMonitoringResult({
              deviceId: devId,
              timestamp,
              status: finalStatus,
              latency: probe.latency,
              packetLoss,
              message: probe.message || (finalStatus === 'UP' ? `OK: ${probe.latency}ms` : 'Host unreachable')
            });

            // Broadcast status in real-time
            broadcastDeviceStatus({
              deviceId: Number(device.id),
              name: device.name,
              ip: device.ip,
              status: result.status,
              latency: result.latency,
              packetLoss: result.packetLoss,
              trafficIn: result.trafficIn,
              trafficOut: result.trafficOut,
              speedMbps: result.speedMbps,
              timestamp: result.timestamp,
              message: result.message
            });

            if (newAlert) {
              broadcastNewAlert(newAlert);
            }

            if (resolvedAlerts && resolvedAlerts.length > 0) {
              for (const resolved of resolvedAlerts) {
                broadcastAlertResolved(resolved);
              }
            }
          } catch (devErr) {
            // Silently ignore individual device probe errors
          }
        })
      );
    }
  } catch (err) {
    console.error('[BackgroundMonitor] Error during sweep:', err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the internal automated background monitor.
 * Polls every 5 seconds.
 */
export function startBackgroundMonitor(intervalMs = 5000) {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
  }

  console.log(`[BackgroundMonitor] 🚀 Internal Node.js Auto-Monitor started (Interval: ${intervalMs}ms)`);

  // Run first sweep after 1 second
  setTimeout(runMonitoringSweep, 1000);

  // Then recurring every intervalMs
  monitorIntervalId = setInterval(runMonitoringSweep, intervalMs);
}

export function stopBackgroundMonitor() {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
    console.log('[BackgroundMonitor] Stopped');
  }
}

export default {
  startBackgroundMonitor,
  stopBackgroundMonitor,
  runMonitoringSweep
};
