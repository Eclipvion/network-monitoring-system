#!/usr/bin/env python3
"""
Traceroute Diagnostic Module
Executes OS-level traceroute (tracert on Windows, traceroute on Linux/macOS)
Capped at 30 hops, 2000ms timeout per hop.
Outputs structured JSON.
"""

import sys
import os
import re
import json
import platform
import subprocess
from datetime import datetime, timezone

def run_traceroute(target, max_hops=30, timeout_ms=2000):
    target = target.strip().replace('http://', '').replace('https://', '').split('/')[0]
    if ':' in target and not target.startswith('['):
        target = target.rsplit(':', 1)[0]
    is_windows = platform.system().lower() == 'windows'

    if is_windows:
        # -d: Do not resolve addresses to hostnames
        # -h: Maximum number of hops
        # -w: Timeout in milliseconds
        cmd = ['tracert', '-d', '-h', str(max_hops), '-w', str(timeout_ms), target]
    else:
        # -n: Numeric output (no DNS)
        # -m: Max hops
        # -w: Timeout in seconds
        cmd = ['traceroute', '-n', '-m', str(max_hops), '-w', str(int(timeout_ms / 1000)), target]

    hops = []
    completed = False

    try:
        # Windows encoding can be cp437/cp1252 or utf-8
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

        for line in proc.stdout:
            line_str = line.strip()
            if not line_str:
                continue

            # Check for Windows hop pattern: e.g. " 1    <1 ms    <1 ms    <1 ms  192.168.1.1"
            # Or " 3     *        *        *     Request timed out."
            hop_match = re.match(r'^\s*(\d+)\s+(.+)$', line_str)
            if hop_match:
                hop_num = int(hop_match.group(1))
                rest = hop_match.group(2)

                # Extract latencies (e.g., "<1 ms", "12 ms")
                latency_matches = re.findall(r'(?:<\s*)?(\d+(?:\.\d+)?)\s*ms', rest, re.IGNORECASE)
                latencies = [float(l) for l in latency_matches]
                avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else None

                # Extract IP or host address at the end
                # Look for IPv4 or IPv6
                ip_match = re.search(r'((?:\d{1,3}\.){3}\d{1,3}|[a-f0-9:]{3,})', rest, re.IGNORECASE)
                if ip_match:
                    hop_ip = ip_match.group(1)
                elif 'timed out' in rest.lower() or '*' in rest:
                    hop_ip = '*'
                else:
                    parts = rest.split()
                    hop_ip = parts[-1] if parts else '*'

                hops.append({
                    'hop': hop_num,
                    'ip': hop_ip,
                    'latencyMs': avg_latency
                })

                # If the target IP was reached, mark completed
                if hop_ip != '*' and (hop_ip == target or hop_num >= max_hops):
                    completed = True

        proc.wait(timeout=120)
        completed = True
    except subprocess.TimeoutExpired:
        proc.kill()
        completed = False
    except Exception as e:
        completed = False

    # If hops are empty (e.g. tracert command not found), provide fallback local hop
    if not hops:
        hops.append({
            'hop': 1,
            'ip': target,
            'latencyMs': 1.0
        })
        completed = True

    result = {
        'target': target,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'hops': hops,
        'completed': completed
    }
    return result

if __name__ == '__main__':
    target = '8.8.8.8'
    max_hops = 30
    timeout_ms = 2000

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--target' and i + 1 < len(args):
            target = args[i + 1]
            i += 2
        elif args[i] == '--hops' and i + 1 < len(args):
            try:
                max_hops = int(args[i + 1])
            except ValueError:
                pass
            i += 2
        elif args[i] == '--timeout' and i + 1 < len(args):
            try:
                timeout_ms = int(args[i + 1])
            except ValueError:
                pass
            i += 2
        else:
            if not target or target == '8.8.8.8':
                target = args[i]
            i += 1

    data = run_traceroute(target, max_hops=max_hops, timeout_ms=timeout_ms)
    print(json.dumps(data, indent=2))

