"""
NetPulse Cyber Threat & DNS Traffic Sniffer
Captures outbound/inbound DNS queries on UDP Port 53 and system DNS events,
and streams them to the NetPulse Security Hub API (http://localhost:5000/api/security/log-dns).
"""

import sys
import time
import json
import socket
import struct
import urllib.request
import urllib.error
import subprocess

API_URL = "http://localhost:5000/api/security/log-dns"
HARVEST_URL = "http://localhost:5000/api/security/dns-harvest"

def post_dns_query(domain, client_ip="127.0.0.1", query_type="A"):
    if not domain or len(domain) < 3:
        return
    
    payload = json.dumps({
        "domain": domain,
        "clientIp": client_ip,
        "queryType": query_type
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            pass
    except Exception:
        pass

def parse_dns_name(payload, offset):
    """Parses DNS wire format QNAME."""
    labels = []
    while offset < len(payload):
        length = payload[offset]
        if length == 0:
            offset += 1
            break
        # Pointer check
        if (length & 0xC0) == 0xC0:
            offset += 2
            break
        offset += 1
        labels.append(payload[offset:offset + length].decode("latin1", errors="ignore"))
        offset += length
    return ".".join(labels), offset

def run_udp_socket_sniffer():
    """Tries raw UDP socket on 53 if permitted, otherwise returns False."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_UDP)
        s.settimeout(2.0)
        return s
    except Exception:
        return None

def run_powershell_cache_monitor():
    """Polls Windows DNS Client Cache periodically (Runs cleanly without Admin rights)."""
    seen_domains = set()
    print("[Threat Sniffer] Monitoring local DNS queries via System Cache & Network Sockets...")

    while True:
        try:
            ps_cmd = 'Get-DnsClientCache | Where-Object { $_.Entry -ne "" } | Select-Object -First 25 Entry, Type | ConvertTo-Json'
            proc = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_cmd],
                capture_output=True,
                text=True,
                timeout=5
            )

            if proc.returncode == 0 and proc.stdout.strip():
                try:
                    data = json.loads(proc.stdout)
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        entry = item.get("Entry", "")
                        qtype = "A" if item.get("Type") == 1 else "AAAA" if item.get("Type") == 28 else "DNS"
                        if entry and entry not in seen_domains and not entry.startswith("_"):
                            seen_domains.add(entry)
                            if len(seen_domains) > 2000:
                                seen_domains.clear()
                            post_dns_query(entry, "Local Host", qtype)
                            print(f"[Captured DNS] {entry} ({qtype})")
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            pass

        time.sleep(5)

if __name__ == "__main__":
    print("=" * 60)
    print("🛡️  NetPulse Cyber Threat & DNS Search Sniffer Started")
    print("📡 Forwarding to:", API_URL)
    print("=" * 60)

    # Initial harvest
    try:
        req = urllib.request.Request(HARVEST_URL, data=b"{}", headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=4)
    except Exception:
        pass

    run_powershell_cache_monitor()
