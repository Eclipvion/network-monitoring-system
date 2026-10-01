#!/usr/bin/env python3
"""
DNS Performance & Resolver Benchmark Module
Uses dnspython to query specified resolvers for a list of test domains,
measures resolution time in milliseconds, and posts telemetry to Node.js API.
"""

import sys
import time
import json
import logging
from datetime import datetime, timezone
import requests
# pyrefly: ignore [missing-import]
import dns.resolver

import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [DNS-Check] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('DNSBenchmark')

def get_dns_settings():
    """Fetch DNS resolvers and test domains from Node API settings"""
    url = f"{config.API_BASE_URL}/settings"
    try:
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            return {
                'resolvers': data.get('dnsResolvers', [
                    { 'name': 'Google', 'ip': '8.8.8.8' },
                    { 'name': 'Cloudflare', 'ip': '1.1.1.1' },
                    { 'name': 'Quad9', 'ip': '9.9.9.9' }
                ]),
                'domains': data.get('dnsTestDomains', ['google.com', 'cloudflare.com']),
                'interval': data.get('dnsCheckIntervalSeconds', 300)
            }
    except Exception as e:
        logger.warning(f"Could not load settings from {url}: {e}. Using defaults.")

    return {
        'resolvers': [
            { 'name': 'Google', 'ip': '8.8.8.8' },
            { 'name': 'Cloudflare', 'ip': '1.1.1.1' },
            { 'name': 'Quad9', 'ip': '9.9.9.9' }
        ],
        'domains': ['google.com', 'cloudflare.com'],
        'interval': 300
    }

def benchmark_query(resolver_ip, domain, timeout_sec=2.0):
    """
    Performs a DNS query against a specific resolver IP.
    Returns: (resolution_time_ms, success)
    """
    custom_resolver = dns.resolver.Resolver(configure=False)
    custom_resolver.nameservers = [resolver_ip]
    custom_resolver.lifetime = timeout_sec
    custom_resolver.timeout = timeout_sec

    start_time = time.perf_counter()
    try:
        answers = custom_resolver.resolve(domain, 'A')
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return round(elapsed_ms, 2), True
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return round(elapsed_ms, 2), False

def post_dns_result(result_payload):
    """Posts DNS benchmark result to Node API"""
    url = f"{config.API_BASE_URL}/dns/result"
    try:
        resp = requests.post(url, json=result_payload, timeout=5)
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.error(f"Failed to post DNS result to {url}: {e}")
        return False

def run_dns_checks():
    """Runs a single round of benchmarks across all resolvers and domains"""
    cfg = get_dns_settings()
    resolvers = cfg['resolvers']
    domains = cfg['domains']

    results = []
    logger.info(f"Starting DNS benchmark cycle ({len(resolvers)} resolvers, {len(domains)} domains)...")

    for r in resolvers:
        r_name = r.get('name', r.get('ip'))
        r_ip = r.get('ip')
        for d in domains:
            res_time, success = benchmark_query(r_ip, d)
            payload = {
                "resolver": r_ip,
                "resolverName": r_name,
                "domain": d,
                "resolutionTimeMs": res_time,
                "success": success,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            results.append(payload)
            status_text = f"SUCCESS ({res_time}ms)" if success else "FAILED"
            logger.info(f"[{r_name} | {r_ip}] -> {d}: {status_text}")
            post_dns_result(payload)
            time.sleep(0.05)

    return results

def run_loop():
    logger.info("==================================================")
    logger.info("🌐 DNS Performance Benchmark Service Started")
    logger.info(f"📡 API Endpoint: {config.API_BASE_URL}")
    logger.info("==================================================")

    while True:
        try:
            cfg = get_dns_settings()
            run_dns_checks()
            interval = cfg.get('interval', 300)
            logger.info(f"Sleeping for {interval}s until next DNS benchmark round...")
            time.sleep(interval)
        except Exception as e:
            logger.error(f"Error in DNS benchmark loop: {e}", exc_info=True)
            time.sleep(30)

if __name__ == '__main__':
    if '--once' in sys.argv or '-1' in sys.argv:
        res = run_dns_checks()
        print(json.dumps(res, indent=2))
    else:
        try:
            run_loop()
        except KeyboardInterrupt:
            logger.info("DNS Benchmark stopped by user.")
            sys.exit(0)
