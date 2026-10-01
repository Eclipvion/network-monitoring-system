#!/usr/bin/env python3
"""
Domain & SSL Health Monitoring Module
Checks DNS resolution, HTTP/HTTPS response latency and status code,
and inspects TLS/SSL certificates for validity and upcoming expiration.
"""

import sys
import os
import time
import json
import socket
import ssl
import logging
from datetime import datetime, timezone
import requests
# pyrefly: ignore [missing-import]
import dns.resolver

import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [DomainHealth] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('DomainHealth')

def get_domains():
    """Fetch domains from Node.js API"""
    url = f"{config.API_BASE_URL}/domains"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Could not fetch domains from {url}: {e}")
    return []

def check_dns(domain_name):
    """Resolves A record for the domain"""
    try:
        answers = dns.resolver.resolve(domain_name, 'A', lifetime=3.0)
        ips = [str(rdata) for rdata in answers]
        return True, ips[0] if ips else None
    except Exception as e:
        return False, None

def check_http(domain_name):
    """Performs HTTPS GET request and measures roundtrip time"""
    url = f"https://{domain_name}"
    start = time.perf_counter()
    try:
        resp = requests.get(url, timeout=5.0, allow_redirects=True, headers={'User-Agent': 'NetPulse-HealthChecker/1.0'})
        elapsed_ms = round((time.perf_counter() - start) * 1000.0, 1)
        return resp.status_code, elapsed_ms
    except requests.exceptions.SSLError:
        # Fallback to HTTP if SSL error during request
        try:
            http_url = f"http://{domain_name}"
            resp = requests.get(http_url, timeout=5.0, allow_redirects=True)
            elapsed_ms = round((time.perf_counter() - start) * 1000.0, 1)
            return resp.status_code, elapsed_ms
        except Exception:
            return None, None
    except Exception:
        return None, None

def check_ssl(domain_name, port=443, timeout_sec=4.0):
    """
    Connects to domain via TLS socket and reads certificate expiration.
    Returns: (ssl_valid, ssl_expires_at_iso, days_remaining)
    """
    context = ssl.create_default_context()
    try:
        with socket.create_connection((domain_name, port), timeout=timeout_sec) as sock:
            with context.wrap_socket(sock, server_hostname=domain_name) as ssock:
                cert = ssock.getpeercert()
                if not cert or 'notAfter' not in cert:
                    return False, None, None

                # SSL date format: 'Sep 28 12:00:00 2026 GMT'
                expire_str = cert['notAfter']
                expire_date = datetime.strptime(expire_str, '%b %d %H:%M:%S %Y %Z').replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                days_left = (expire_date - now).total_seconds() / 86400.0
                days_remaining = max(0, int(days_left))
                return True, expire_date.isoformat(), days_remaining
    except ssl.SSLCertVerificationError:
        return False, None, 0
    except Exception:
        return False, None, None

def check_single_domain(domain_obj):
    domain_id = domain_obj.get('id')
    raw_domain = domain_obj.get('domain', '').strip().replace('https://', '').replace('http://', '').split('/')[0]

    if not raw_domain:
        return None

    # 1. DNS Resolution
    dns_resolved, resolved_ip = check_dns(raw_domain)

    # 2. HTTP/HTTPS Check
    http_status, resp_time = check_http(raw_domain)

    # 3. SSL Expiry Check
    ssl_valid, ssl_expires_at, ssl_days = check_ssl(raw_domain)

    payload = {
        "domainId": domain_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "httpStatus": http_status,
        "responseTimeMs": resp_time,
        "sslValid": ssl_valid,
        "sslExpiresAt": ssl_expires_at,
        "sslDaysRemaining": ssl_days,
        "dnsResolved": dns_resolved,
        "resolvedIp": resolved_ip
    }

    logger.info(
        f"Domain {raw_domain} -> DNS: {'OK' if dns_resolved else 'FAIL'} ({resolved_ip}) | "
        f"HTTP: {http_status} ({resp_time}ms) | SSL Days: {ssl_days}"
    )

    return payload

def post_domain_result(payload):
    url = f"{config.API_BASE_URL}/domain-health/result"
    try:
        resp = requests.post(url, json=payload, timeout=5)
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.error(f"Failed to post domain health result to {url}: {e}")
        return False

def run_all_domains():
    domains = get_domains()
    results = []
    for d in domains:
        if not d.get('monitoring', True):
            continue
        res = check_single_domain(d)
        if res:
            results.append(res)
            post_domain_result(res)
            time.sleep(0.1)
    return results

def run_loop():
    logger.info("==================================================")
    logger.info("🔒 Domain Health & SSL Monitor Started")
    logger.info(f"📡 API Endpoint: {config.API_BASE_URL}")
    logger.info("==================================================")

    domain_states = {}

    while True:
        try:
            domains = get_domains()
            now = time.time()
            for d in domains:
                d_id = d.get('id')
                if not d.get('monitoring', True):
                    continue
                interval = float(d.get('interval') or 3600)
                last_check = domain_states.get(d_id, 0)
                if now - last_check >= interval:
                    res = check_single_domain(d)
                    if res:
                        post_domain_result(res)
                    domain_states[d_id] = now
        except Exception as e:
            logger.error(f"Error in domain monitoring loop: {e}", exc_info=True)

        time.sleep(10)

if __name__ == '__main__':
    if '--once' in sys.argv or '-1' in sys.argv:
        res = run_all_domains()
        print(json.dumps(res, indent=2))
    elif len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        # Check specific domain passed as argument
        test_domain = sys.argv[1]
        out = check_single_domain({'id': 0, 'domain': test_domain})
        print(json.dumps(out, indent=2))
    else:
        try:
            run_loop()
        except KeyboardInterrupt:
            logger.info("Domain monitor stopped by user.")
            sys.exit(0)
