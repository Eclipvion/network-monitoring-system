#!/usr/bin/env python3
"""
Fast Local Network & Subnet Scanner
Auto-discovers active devices, hostnames (reverse DNS), latency, and device types.
Designed for NetPulse Network Monitoring System.
"""

import sys
import os
import re
import socket
import subprocess
import platform
import json
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_local_ip_and_subnet():
    """Detects active local network adapter IPv4 address and suggested /24 subnet."""
    local_ip = "192.168.1.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass

    parts = local_ip.split(".")
    if len(parts) == 4:
        base = f"{parts[0]}.{parts[1]}.{parts[2]}"
        return {
            "localIp": local_ip,
            "subnet": f"{base}.0/24",
            "startIp": f"{base}.1",
            "endIp": f"{base}.254"
        }
    return {
        "localIp": "192.168.1.10",
        "subnet": "192.168.1.0/24",
        "startIp": "192.168.1.1",
        "endIp": "192.168.1.254"
    }

def quick_ping_icmp(ip, timeout_ms=600):
    """Pings IP via OS ICMP ping."""
    is_windows = platform.system().lower() == "windows"
    if is_windows:
        cmd = ["ping", "-4", "-n", "1", "-w", str(timeout_ms), ip]
    else:
        timeout_sec = max(1, int(timeout_ms / 1000))
        cmd = ["ping", "-4", "-c", "1", "-W", str(timeout_sec), ip]

    try:
        start = time.perf_counter()
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=(timeout_ms / 1000.0) + 0.5
        )
        if proc.returncode == 0:
            elapsed = (time.perf_counter() - start) * 1000.0
            # Extract latency from output if available
            match = re.search(r"time[=<]\s*([0-9.]+)\s*ms", proc.stdout, re.IGNORECASE)
            if match:
                return float(match.group(1))
            return round(elapsed, 1)
        return None
    except Exception:
        return None

def quick_tcp_check(ip, port, timeout_sec=0.5):
    """Checks if a TCP port is open and measures connect time."""
    start = time.perf_counter()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout_sec)
    try:
        res = sock.connect_ex((ip, port))
        sock.close()
        if res == 0:
            elapsed = (time.perf_counter() - start) * 1000.0
            return round(elapsed, 1)
        return None
    except Exception:
        try:
            sock.close()
        except Exception:
            pass
        return None

def resolve_hostname(ip):
    """Attempts reverse DNS to resolve host or PC name."""
    try:
        host, _, _ = socket.gethostbyaddr(ip)
        return host
    except Exception:
        return None

def guess_device_type(hostname, open_ports, ip_ending):
    """Infers device type based on open ports, hostname, or IP convention."""
    h_lower = (hostname or "").lower()
    if any(k in h_lower for k in ["router", "gateway", "modem", "dlink", "tplink", "cisco", "netgear", "mikrotik"]):
        return "router"
    if any(k in h_lower for k in ["print", "hp", "epson", "canon", "brother", "xerox"]):
        return "printer"
    if any(k in h_lower for k in ["switch", "cisco-sw"]):
        return "switch"
    if any(k in h_lower for k in ["server", "dc", "ad-", "dns", "storage", "nas", "truenas"]):
        return "server"
    if any(k in h_lower for k in ["desktop", "laptop", "pc", "macbook", "workstation"]):
        return "workstation"

    if 445 in open_ports or 3389 in open_ports:
        return "workstation"
    if 22 in open_ports:
        return "server"
    if 9100 in open_ports or 515 in open_ports or 631 in open_ports:
        return "printer"
    if 80 in open_ports or 443 in open_ports:
        if ip_ending in (1, 254):
            return "router"
        return "server"
    
    if ip_ending in (1, 254):
        return "router"

    return "workstation"

def scan_single_host(ip):
    """Probes a single IP address with ICMP and fallback TCP ports."""
    latency = quick_ping_icmp(ip, timeout_ms=500)
    open_ports = []
    ports_to_check = [80, 443, 445, 22, 3389, 8080]

    # If ICMP answered, do quick probe on common ports
    if latency is not None:
        for p in ports_to_check:
            t = quick_tcp_check(ip, p, timeout_sec=0.15)
            if t is not None:
                open_ports.append(p)
    else:
        # Fallback TCP check in case host drops ICMP
        for p in ports_to_check:
            t = quick_tcp_check(ip, p, timeout_sec=0.3)
            if t is not None:
                open_ports.append(p)
                if latency is None:
                    latency = t

    if latency is None and not open_ports:
        return None

    hostname = resolve_hostname(ip)
    ip_end = int(ip.split(".")[-1]) if "." in ip else 0
    dev_type = guess_device_type(hostname, open_ports, ip_end)

    friendly_name = hostname if hostname else f"Host ({ip})"

    return {
        "ip": ip,
        "name": friendly_name,
        "hostname": hostname or "",
        "latency": latency if latency is not None else 1.0,
        "type": dev_type,
        "openPorts": open_ports,
        "status": "UP"
    }

def ip_to_int(ip_str):
    parts = [int(p) for p in ip_str.split(".")]
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]

def int_to_ip(ip_int):
    return f"{(ip_int >> 24) & 0xFF}.{(ip_int >> 16) & 0xFF}.{(ip_int >> 8) & 0xFF}.{ip_int & 0xFF}"

def scan_network_range(start_ip, end_ip, max_workers=50):
    start_int = ip_to_int(start_ip)
    end_int = ip_to_int(end_ip)
    
    if end_int < start_int:
        start_int, end_int = end_int, start_int

    # Cap to max 256 hosts per scan for safety
    if (end_int - start_int) > 512:
        end_int = start_int + 254

    ips = [int_to_ip(i) for i in range(start_int, end_int + 1)]
    alive_hosts = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_ip = {executor.submit(scan_single_host, ip): ip for ip in ips}
        for future in as_completed(future_to_ip):
            try:
                res = future.result()
                if res:
                    alive_hosts.append(res)
            except Exception:
                pass

    # Sort results by IP address
    alive_hosts.sort(key=lambda h: ip_to_int(h["ip"]))
    return alive_hosts

def main():
    parser = argparse.ArgumentParser(description="NetPulse Local Network Auto-Discovery Scanner")
    parser.add_argument("--info", action="store_true", help="Print local network info and exit")
    parser.add_argument("--start", type=str, help="Start IPv4 address")
    parser.add_argument("--end", type=str, help="End IPv4 address")
    parser.add_argument("--subnet", type=str, help="Subnet e.g. 192.168.1.0/24")
    parser.add_argument("--workers", type=int, default=50, help="Concurrent worker threads")

    args = parser.parse_args()

    if args.info:
        info = get_local_ip_and_subnet()
        print(json.dumps(info))
        return

    start_ip = args.start
    end_ip = args.end

    if args.subnet:
        match = re.match(r"^(\d+\.\d+\.\d+)\.0/24$", args.subnet.strip())
        if match:
            start_ip = f"{match.group(1)}.1"
            end_ip = f"{match.group(1)}.254"

    if not start_ip or not end_ip:
        net_info = get_local_ip_and_subnet()
        start_ip = net_info["startIp"]
        end_ip = net_info["endIp"]

    alive = scan_network_range(start_ip, end_ip, max_workers=args.workers)
    print(json.dumps({
        "startIp": start_ip,
        "endIp": end_ip,
        "totalScanned": ip_to_int(end_ip) - ip_to_int(start_ip) + 1,
        "aliveCount": len(alive),
        "devices": alive
    }))

if __name__ == "__main__":
    main()
