import sys
import time
import re
import socket
import subprocess
import platform
import logging
from datetime import datetime, timezone
import requests
# pyrefly: ignore [missing-import]
import ping3
import psutil

import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('NetworkMonitor')

# Track state of each device: { device_id: { 'consecutive_failures': int, 'last_checked': float } }
device_states = {}

def get_system_settings():
    """Fetch threshold and retry settings from Node API"""
    url = f"{config.API_BASE_URL}/settings"
    try:
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Could not fetch settings from {url}: {e}. Using defaults.")
    return {
        "defaultInterval": 30,
        "latencyWarningThresholdMs": 150,
        "packetLossWarningPercent": 20,
        "retryCountBeforeDown": 2
    }

def get_devices():
    """Fetch configured devices from Node API"""
    url = f"{config.API_BASE_URL}/devices"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.error(f"Error fetching devices from {url}: {e}")
        return []

def ping_system_fallback(ip, timeout_sec=1.5):
    """
    Fallback ping implementation using OS ping command.
    Used when ping3 doesn't have raw socket permissions (e.g., non-admin Windows).
    """
    is_windows = platform.system().lower() == 'windows'
    timeout_ms = int(timeout_sec * 1000)

    if is_windows:
        cmd = ['ping', '-4', '-n', '1', '-w', str(timeout_ms), ip]
    else:
        cmd = ['ping', '-c', '1', '-W', str(int(timeout_sec)), ip]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_sec + 1.0
        )
        if proc.returncode == 0:
            # Parse roundtrip latency
            output = proc.stdout
            # Windows ping pattern: "time=12ms" or "time<1ms" or "Minimum = 12ms"
            match = re.search(r'time[=<]\s*([0-9.]+)\s*ms', output, re.IGNORECASE)
            if not match:
                match = re.search(r'Average\s*=\s*([0-9.]+)ms', output, re.IGNORECASE)
            
            if match:
                return float(match.group(1))
            return 1.0 # Ping succeeded but time parser defaulted
        return None
    except Exception:
        return None

def single_ping(ip, timeout_sec):
    """Attempts ping3 first, falling back gracefully to system ping if permission denied."""
    try:
        res = ping3.ping(ip, timeout=timeout_sec, unit='ms')
        if res is False or res is None:
            # Could be timeout or destination unreachable
            return None
        return float(res)
    except PermissionError:
        # Raw socket requires root/administrator, fallback to OS ping
        return ping_system_fallback(ip, timeout_sec)
    except Exception as e:
        # Fallback to system ping for any other socket/OS error
        return ping_system_fallback(ip, timeout_sec)

def tcp_ping(host, port, timeout_sec=2.0):
    """
    Measures TCP handshake latency (identical to Sysinternals PsPing).
    Works for cloud providers (Azure, AWS, Cloudflare) that drop ICMP echo packets.
    """
    start = time.perf_counter()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout_sec)
    try:
        sock.connect((host, int(port)))
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        sock.close()
        return round(elapsed_ms, 2)
    except Exception:
        try:
            sock.close()
        except Exception:
            pass
        return None

def probe_device(target, probes=3, timeout_sec=1.5):
    """
    Probes an IP address or hostname multiple times to calculate latency and packet loss.
    Supports:
      1. ICMP ping (raw socket ping3 with OS IPv4 ping fallback)
      2. Explicit TCP ping if port is provided (e.g., target: "57.150.61.1:443")
      3. Automatic TCP fallback (port 443/80) when ICMP is blocked by cloud firewalls like Azure
    Returns: (avg_latency_ms, packet_loss_percent, success_probes)
    """
    latencies = []
    lost_packets = 0

    # Parse target into host and optional port
    raw_target = str(target).strip()
    host = raw_target
    port = None

    if ':' in raw_target and not raw_target.startswith('['):
        parts = raw_target.rsplit(':', 1)
        host = parts[0]
        try:
            port = int(parts[1])
        except ValueError:
            port = None

    # Pre-resolve hostname to IPv4 outside the timing loop so DNS resolution
    # overhead does not artificially inflate network latency.
    resolved_host = host
    if not re.match(r'^(?:\d{1,3}\.){3}\d{1,3}$', host):
        try:
            resolved_host = socket.gethostbyname(host)
        except Exception:
            resolved_host = host

    for _ in range(probes):
        lat = None
        if port is not None:
            # Explicit port specified -> Use TCP ping directly (PsPing mode)
            lat = tcp_ping(resolved_host, port, timeout_sec=timeout_sec)
        else:
            # Try ICMP ping first on the resolved IPv4 target
            lat = single_ping(resolved_host, timeout_sec)
            # If ICMP is blocked/dropped (standard behavior for Azure), fallback to TCP port 443 then 80
            if lat is None:
                lat = tcp_ping(resolved_host, 443, timeout_sec=timeout_sec)
                if lat is None:
                    lat = tcp_ping(resolved_host, 80, timeout_sec=timeout_sec)

        if lat is not None:
            latencies.append(lat)
        else:
            lost_packets += 1
        time.sleep(0.1)

    packet_loss = (lost_packets / probes) * 100.0
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else None

    return avg_latency, packet_loss, len(latencies)

def post_result(device_id, status, latency, packet_loss, message):
    """Posts monitoring result to Node API"""
    url = f"{config.API_BASE_URL}/monitoring/result"
    payload = {
        "deviceId": device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "latency": latency,
        "packetLoss": packet_loss,
        "message": message
    }
    try:
        resp = requests.post(url, json=payload, timeout=5)
        if resp.status_code in (200, 201):
            return True
        else:
            logger.warning(f"Node server rejected result for device {device_id}: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Failed to post monitoring result to {url}: {e}")
    return False

def check_device(device, settings):
    """Evaluates a single device and determines UP/DOWN/WARNING status"""
    dev_id = device['id']
    name = device.get('name', f'Device #{dev_id}')
    ip = device.get('ip')
    
    if not ip:
        return

    retry_count_before_down = int(settings.get('retryCountBeforeDown', 2))
    latency_warn_threshold = float(settings.get('latencyWarningThresholdMs', 150))
    packet_loss_warn_threshold = float(settings.get('packetLossWarningPercent', 20))

    if dev_id not in device_states:
        device_states[dev_id] = {
            'consecutive_failures': 0,
            'last_checked': 0
        }

    state = device_states[dev_id]
    probes_count = config.PING_PROBES_COUNT
    timeout_sec = config.PING_TIMEOUT_SECONDS

    avg_latency, packet_loss, success_count = probe_device(ip, probes=probes_count, timeout_sec=timeout_sec)
    state['last_checked'] = time.time()

    if success_count == 0:
        # Complete failure
        state['consecutive_failures'] += 1
        fails = state['consecutive_failures']

        if fails >= retry_count_before_down:
            status = 'DOWN'
            message = f"Ping failed ({fails}/{retry_count_before_down} retries): Destination Host Unreachable"
        else:
            status = 'WARNING'
            message = f"Ping attempt failed ({fails}/{retry_count_before_down} retries pending)"

        logger.info(f"[{status}] {name} ({ip}) - Fails: {fails}/{retry_count_before_down} - 100% loss")
    else:
        # At least one ping succeeded
        state['consecutive_failures'] = 0

        if avg_latency > latency_warn_threshold or packet_loss > packet_loss_warn_threshold:
            status = 'WARNING'
            reasons = []
            if avg_latency > latency_warn_threshold:
                reasons.append(f"High Latency ({avg_latency:.1f}ms > {latency_warn_threshold}ms)")
            if packet_loss > packet_loss_warn_threshold:
                reasons.append(f"Packet Loss ({packet_loss:.0f}% > {packet_loss_warn_threshold}%)")
            message = ", ".join(reasons)
        else:
            status = 'UP'
            message = f"OK: {avg_latency:.1f}ms, {packet_loss:.0f}% loss"

        logger.info(f"[{status}] {name} ({ip}) - Latency: {avg_latency:.1f}ms | Loss: {packet_loss:.0f}%")

    post_result(dev_id, status, avg_latency, packet_loss, message)

def run_loop():
    logger.info("==================================================")
    logger.info("🚀 Python Network Monitoring Engine Started")
    logger.info(f"📡 API Endpoint: {config.API_BASE_URL}")
    logger.info(f"⏱️ Poll Interval: {config.PYTHON_WORKER_POLL_INTERVAL}s")
    logger.info(f"🔍 Ping Probes per Check: {config.PING_PROBES_COUNT}")
    logger.info("==================================================")

    while True:
        try:
            settings = get_system_settings()
            devices = get_devices()

            now = time.time()
            for dev in devices:
                dev_id = dev.get('id')
                monitoring_enabled = dev.get('monitoring', True)
                if not monitoring_enabled:
                    continue

                interval = float(dev.get('interval') or settings.get('defaultInterval', 30))
                dev_state = device_states.setdefault(dev_id, {'consecutive_failures': 0, 'last_checked': 0})
                
                # Check if it's time to probe this device
                if now - dev_state['last_checked'] >= interval:
                    check_device(dev, settings)

        except Exception as e:
            logger.error(f"Unexpected error in monitoring cycle: {e}", exc_info=True)

        time.sleep(config.PYTHON_WORKER_POLL_INTERVAL)

if __name__ == '__main__':
    try:
        run_loop()
    except KeyboardInterrupt:
        logger.info("Monitoring engine stopped by user.")
        sys.exit(0)
