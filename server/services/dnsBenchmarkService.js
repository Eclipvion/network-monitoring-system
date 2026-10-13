import dns from 'dns';
import { performance } from 'perf_hooks';

/**
 * Curated Directory of 40+ Authoritative Global Public DNS Resolvers
 * Inspired by dnsspeedtest.online, DNS Benchmark, and Namebench
 */
export const DNS_RESOLVER_DIRECTORY = [
  // 1. Ultra-Fast Anycast
  {
    id: 'cloudflare-primary',
    name: 'Cloudflare (Primary)',
    provider: 'Cloudflare',
    ip: '1.1.1.1',
    secondaryIp: '1.0.0.1',
    ipv6: '2606:4700:4700::1111',
    category: 'fastest',
    features: ['Zero-Logs', 'DNSSEC', 'Ultra-Fast Anycast', 'DOH/DOT'],
    description: 'Fastest consumer DNS directory with strict privacy guarantees (KPMG audited).',
    location: 'Global Anycast (300+ Cities)'
  },
  {
    id: 'cloudflare-secondary',
    name: 'Cloudflare (Secondary)',
    provider: 'Cloudflare',
    ip: '1.0.0.1',
    secondaryIp: '1.1.1.1',
    ipv6: '2606:4700:4700::1001',
    category: 'fastest',
    features: ['Zero-Logs', 'DNSSEC', 'Ultra-Fast Anycast'],
    description: 'Cloudflare secondary edge node for redundant failover.',
    location: 'Global Anycast'
  },
  {
    id: 'google-primary',
    name: 'Google Public DNS (Primary)',
    provider: 'Google',
    ip: '8.8.8.8',
    secondaryIp: '8.8.4.4',
    ipv6: '2001:4860:4860::8888',
    category: 'fastest',
    features: ['Global CDN', 'Anycast', 'DNSSEC', 'High Reliability'],
    description: 'Massive globally distributed DNS infrastructure by Google.',
    location: 'Global Anycast'
  },
  {
    id: 'google-secondary',
    name: 'Google Public DNS (Secondary)',
    provider: 'Google',
    ip: '8.8.4.4',
    secondaryIp: '8.8.8.8',
    ipv6: '2001:4860:4860::8844',
    category: 'fastest',
    features: ['Global CDN', 'Anycast', 'DNSSEC'],
    description: 'Google redundant secondary nameserver.',
    location: 'Global Anycast'
  },
  {
    id: 'opendns-primary',
    name: 'OpenDNS / Cisco (Home)',
    provider: 'Cisco Systems',
    ip: '208.67.222.222',
    secondaryIp: '208.67.220.220',
    ipv6: '2620:119:35::35',
    category: 'fastest',
    features: ['Phishing Protection', 'Fast Anycast', 'High Uptime'],
    description: 'Cisco OpenDNS with automated malicious domain blocking and web filtering.',
    location: 'Global Anycast'
  },
  {
    id: 'opendns-secondary',
    name: 'OpenDNS / Cisco (Secondary)',
    provider: 'Cisco Systems',
    ip: '208.67.220.220',
    secondaryIp: '208.67.222.222',
    ipv6: '2620:119:53::53',
    category: 'fastest',
    features: ['Phishing Protection', 'Fast Anycast'],
    description: 'OpenDNS secondary nameserver for resilient name resolution.',
    location: 'Global Anycast'
  },
  {
    id: 'level3-primary',
    name: 'Level3 / Lumen (4.2.2.1)',
    provider: 'Lumen Technologies',
    ip: '4.2.2.1',
    secondaryIp: '4.2.2.2',
    category: 'fastest',
    features: ['Tier-1 Internet Backbone', 'Ultra-Reliable'],
    description: 'Legacy Tier-1 global transit backbone resolver.',
    location: 'USA / Global Backbone'
  },
  {
    id: 'level3-secondary',
    name: 'Level3 / Lumen (4.2.2.2)',
    provider: 'Lumen Technologies',
    ip: '4.2.2.2',
    secondaryIp: '4.2.2.1',
    category: 'fastest',
    features: ['Tier-1 Internet Backbone'],
    description: 'Legendary 4.2.2.2 nameserver operated by Lumen Tier-1.',
    location: 'USA / Global Backbone'
  },
  {
    id: 'level3-three',
    name: 'Level3 / Lumen (4.2.2.3)',
    provider: 'Lumen Technologies',
    ip: '4.2.2.3',
    secondaryIp: '4.2.2.4',
    category: 'fastest',
    features: ['Tier-1 Internet Backbone'],
    description: 'Lumen high-capacity backbone resolver.',
    location: 'USA / Global Backbone'
  },
  {
    id: 'level3-four',
    name: 'Level3 / Lumen (4.2.2.4)',
    provider: 'Lumen Technologies',
    ip: '4.2.2.4',
    secondaryIp: '4.2.2.3',
    category: 'fastest',
    features: ['Tier-1 Internet Backbone'],
    description: 'Lumen high-capacity backbone resolver.',
    location: 'USA / Global Backbone'
  },
  {
    id: 'gcore-primary',
    name: 'GCore Anycast',
    provider: 'GCore',
    ip: '95.85.95.85',
    secondaryIp: '2.56.220.2',
    category: 'fastest',
    features: ['Edge Anycast', 'Global CDN Backbone', 'DNSSEC'],
    description: 'High-speed public DNS by global edge cloud provider GCore.',
    location: 'Global Edge (140+ PoPs)'
  },
  {
    id: 'verisign-primary',
    name: 'Verisign Public DNS',
    provider: 'Verisign',
    ip: '64.6.64.6',
    secondaryIp: '64.6.65.6',
    category: 'fastest',
    features: ['Enterprise Stability', 'Zero Monetization', 'Root Zone Operator'],
    description: 'Operated by the official .com / .net TLD root registry operator.',
    location: 'Global Anycast'
  },
  {
    id: 'verisign-secondary',
    name: 'Verisign Secondary',
    provider: 'Verisign',
    ip: '64.6.65.6',
    secondaryIp: '64.6.64.6',
    category: 'fastest',
    features: ['Enterprise Stability', 'Zero Monetization'],
    description: 'Verisign secondary DNS resolver.',
    location: 'Global Anycast'
  },
  {
    id: 'neustar-primary',
    name: 'Neustar / UltraDNS',
    provider: 'Neustar / TransUnion',
    ip: '156.154.70.1',
    secondaryIp: '156.154.71.1',
    category: 'fastest',
    features: ['Enterprise Grade', 'DDoS Resilient Anycast'],
    description: 'High availability enterprise public resolver infrastructure.',
    location: 'Global Anycast'
  },
  {
    id: 'he-primary',
    name: 'Hurricane Electric',
    provider: 'Hurricane Electric',
    ip: '74.82.42.42',
    category: 'fastest',
    features: ['Largest IPv6 Transit', 'Global Anycast Backbone'],
    description: 'Operated by Hurricane Electric, the world’s largest IPv6 backbone provider.',
    location: 'Global Backbone'
  },
  {
    id: 'controld-unfiltered',
    name: 'Control D (Unfiltered)',
    provider: 'Control D Inc.',
    ip: '76.76.2.1',
    secondaryIp: '76.76.10.1',
    category: 'fastest',
    features: ['Zero Filtering', 'High Performance', 'Anycast'],
    description: 'Control D unfiltered pure resolver for benchmark testing.',
    location: 'Global Anycast'
  },

  // 2. Security & Threat-Protection
  {
    id: 'quad9-primary',
    name: 'Quad9 Secure (Primary)',
    provider: 'Quad9 Foundation',
    ip: '9.9.9.9',
    secondaryIp: '149.112.112.112',
    ipv6: '2620:fe::fe',
    category: 'security',
    features: ['Threat Blocking', 'Zero-Logs', 'Swiss Privacy Law', 'DNSSEC'],
    description: 'Non-profit Swiss foundation blocking malware, spyware, and phishing domains.',
    location: 'Global Anycast (220+ Locations)'
  },
  {
    id: 'quad9-secondary',
    name: 'Quad9 Secure (Secondary)',
    provider: 'Quad9 Foundation',
    ip: '149.112.112.112',
    secondaryIp: '9.9.9.9',
    ipv6: '2620:fe::9',
    category: 'security',
    features: ['Threat Blocking', 'Zero-Logs', 'Swiss Privacy'],
    description: 'Secondary IP for Quad9 secure threat-mitigating resolver.',
    location: 'Global Anycast'
  },
  {
    id: 'controld-free',
    name: 'Control D (Malware Block)',
    provider: 'Control D Inc.',
    ip: '76.76.2.0',
    secondaryIp: '76.76.10.0',
    ipv6: '2606:1a40::',
    category: 'security',
    features: ['Malware Blocking', 'Modern Anycast', 'Fast Anycast'],
    description: 'High-speed DNS by Windscribe team blocking malware and phishing.',
    location: 'Global Anycast (100+ PoPs)'
  },
  {
    id: 'cleanbrowsing-security',
    name: 'CleanBrowsing Security',
    provider: 'CleanBrowsing',
    ip: '185.228.168.9',
    secondaryIp: '185.228.169.9',
    category: 'security',
    features: ['Phishing Protection', 'Malware Shield', 'Ransomware Filter'],
    description: 'Cybersecurity-focused resolver blocking malicious sites and phishing.',
    location: 'Global Anycast'
  },
  {
    id: 'comodo-secure',
    name: 'Comodo Secure DNS',
    provider: 'Comodo Group',
    ip: '8.26.56.26',
    secondaryIp: '8.20.247.20',
    category: 'security',
    features: ['Malware Protection', 'Phishing Defense', 'Anycast'],
    description: 'Multi-layered threat protection powered by Comodo cyber threat intelligence.',
    location: 'Global Anycast'
  },
  {
    id: 'safedns-primary',
    name: 'SafeDNS',
    provider: 'SafeDNS Inc.',
    ip: '195.46.39.39',
    secondaryIp: '195.46.39.40',
    category: 'security',
    features: ['AI Filtering', 'Malware Block', 'Phishing Protection'],
    description: 'Cloud service provider with AI-powered malicious website filtering.',
    location: 'Global Anycast'
  },
  {
    id: 'cira-canadian',
    name: 'CIRA Canadian Shield',
    provider: 'CIRA (Canada)',
    ip: '149.112.121.10',
    secondaryIp: '149.112.122.10',
    category: 'security',
    features: ['Protected DNS', 'Malware Defense', 'Canadian Privacy'],
    description: 'Protected DNS keeping Canadian and North American users safe from cyber threats.',
    location: 'North America'
  },

  // 3. Ad & Tracker Blocking
  {
    id: 'adguard-default',
    name: 'AdGuard Default (Ad-Block)',
    provider: 'AdGuard',
    ip: '94.140.14.14',
    secondaryIp: '94.140.15.15',
    ipv6: '2a10:50c0::ad1:ff',
    category: 'adblock',
    features: ['Ad-Blocking', 'Tracker Shield', 'Phishing Filter', 'Zero-Logs'],
    description: 'Blocks in-app and browser banner ads, popups, and user-tracking scripts network-wide.',
    location: 'Global Anycast'
  },
  {
    id: 'adguard-secondary',
    name: 'AdGuard Default (Secondary)',
    provider: 'AdGuard',
    ip: '94.140.15.15',
    secondaryIp: '94.140.14.14',
    ipv6: '2a10:50c0::ad2:ff',
    category: 'adblock',
    features: ['Ad-Blocking', 'Tracker Shield', 'Zero-Logs'],
    description: 'AdGuard secondary nameserver for network-level ad-blocking.',
    location: 'Global Anycast'
  },
  {
    id: 'mullvad-adblock',
    name: 'Mullvad (Ad & Tracker Block)',
    provider: 'Mullvad VPN',
    ip: '194.242.2.3',
    secondaryIp: '194.242.2.2',
    category: 'adblock',
    features: ['Ad-Blocking', 'Tracker Blocking', 'Zero-Logs'],
    description: 'Blocks ads and trackers combined with Mullvad strict no-logs policy.',
    location: 'Europe / Anycast'
  },
  {
    id: 'alternatedns-primary',
    name: 'Alternate DNS',
    provider: 'Alternate DNS',
    ip: '76.76.19.19',
    secondaryIp: '76.223.122.150',
    category: 'adblock',
    features: ['Ad-Blocking', 'Unwanted Content Filter'],
    description: 'Blocks ads and unwanted popups before they load in browsers.',
    location: 'USA / Global'
  },

  // 4. Privacy & Zero-Logging
  {
    id: 'quad9-uncensored',
    name: 'Quad9 Uncensored',
    provider: 'Quad9 Foundation',
    ip: '9.9.9.10',
    secondaryIp: '149.112.112.10',
    ipv6: '2620:fe::10',
    category: 'privacy',
    features: ['Zero Filtering', 'Zero-Logs', 'Swiss Privacy', 'DNSSEC'],
    description: 'Quad9 resolver with malware blocking disabled for pure, unfiltered queries.',
    location: 'Global Anycast'
  },
  {
    id: 'nextdns-primary',
    name: 'NextDNS',
    provider: 'NextDNS Inc.',
    ip: '45.90.28.0',
    secondaryIp: '45.90.30.0',
    ipv6: '2a07:a8c0::',
    category: 'privacy',
    features: ['Next-Gen Cloud Firewall', 'Modern Anycast', 'DOH/DOT/DOQ'],
    description: 'Modern cloud-based DNS protecting against malware, trackers, and telemetry.',
    location: 'Global Anycast (250+ PoPs)'
  },
  {
    id: 'adguard-unfiltered',
    name: 'AdGuard Non-filtering',
    provider: 'AdGuard',
    ip: '94.140.14.140',
    secondaryIp: '94.140.14.141',
    ipv6: '2a10:50c0::1:ff',
    category: 'privacy',
    features: ['Unfiltered', 'Zero-Logs', 'DNSSEC'],
    description: 'High-speed AdGuard server without ad-blocking for clean queries.',
    location: 'Global Anycast'
  },
  {
    id: 'mullvad-primary',
    name: 'Mullvad DNS (Zero-Logs)',
    provider: 'Mullvad VPN',
    ip: '194.242.2.2',
    secondaryIp: '194.242.2.3',
    category: 'privacy',
    features: ['Zero Logging', 'Swedish Privacy Law', 'VPN Grade'],
    description: 'Mullvad public resolver with zero logging policy and high privacy standards.',
    location: 'Europe / Anycast'
  },
  {
    id: 'dnswatch-primary',
    name: 'DNS.WATCH',
    provider: 'DNS.WATCH Germany',
    ip: '84.200.69.80',
    secondaryIp: '84.200.70.40',
    category: 'privacy',
    features: ['Zero Logging', 'Fast', 'Uncensored European'],
    description: 'Fast, uncensored DNS without user tracking based in Germany.',
    location: 'Germany / Europe'
  },
  {
    id: 'freedns-primary',
    name: 'FreeDNS',
    provider: 'FreeDNS',
    ip: '45.33.97.5',
    category: 'privacy',
    features: ['Community-Run', 'Uncensored'],
    description: 'Community-operated open resolver focused on openness.',
    location: 'USA / Global'
  },

  // 5. Family & SafeSearch
  {
    id: 'opendns-family',
    name: 'OpenDNS FamilyShield',
    provider: 'Cisco Systems',
    ip: '208.67.222.123',
    secondaryIp: '208.67.220.123',
    ipv6: '2620:119:35::123',
    category: 'family',
    features: ['Adult Content Block', 'Phishing Filter', 'SafeSearch'],
    description: 'Automatically blocks adult content and malicious web domains out of the box.',
    location: 'Global Anycast'
  },
  {
    id: 'adguard-family',
    name: 'AdGuard Family Protection',
    provider: 'AdGuard',
    ip: '94.140.14.15',
    secondaryIp: '94.140.15.16',
    ipv6: '2a10:50c0::bad1:ff',
    category: 'family',
    features: ['Ad-Blocking', 'Adult Content Block', 'SafeSearch Enforcement'],
    description: 'Blocks ads + adult content + enforces Google/Bing SafeSearch mode.',
    location: 'Global Anycast'
  },
  {
    id: 'cleanbrowsing-family',
    name: 'CleanBrowsing Family',
    provider: 'CleanBrowsing',
    ip: '185.228.168.168',
    secondaryIp: '185.228.169.168',
    category: 'family',
    features: ['Strict SafeSearch', 'Adult Block', 'Safe Browsing'],
    description: 'Strict family protection filter used by schools and home networks.',
    location: 'Global Anycast'
  },
  {
    id: 'cleanbrowsing-adult',
    name: 'CleanBrowsing Adult Filter',
    provider: 'CleanBrowsing',
    ip: '185.228.168.10',
    secondaryIp: '185.228.169.11',
    category: 'family',
    features: ['Adult Site Blocking', 'DNSSEC'],
    description: 'Blocks pornography and explicit content while leaving other domains unrestricted.',
    location: 'Global Anycast'
  },

  // 6. Regional & High-Speed Transit
  {
    id: 'alibabadns-primary',
    name: 'AliDNS (Alibaba Cloud)',
    provider: 'Alibaba Group',
    ip: '223.5.5.5',
    secondaryIp: '223.6.6.6',
    ipv6: '2400:3200::1',
    category: 'regional',
    features: ['Asia-Pacific Anycast', 'Ultra-Low Latency in Asia', 'BGP Optimized'],
    description: 'Leading public DNS service in Asia-Pacific with global BGP Anycast routing.',
    location: 'Asia-Pacific / Global Anycast'
  },
  {
    id: 'alibabadns-secondary',
    name: 'AliDNS (Secondary)',
    provider: 'Alibaba Group',
    ip: '223.6.6.6',
    secondaryIp: '223.5.5.5',
    category: 'regional',
    features: ['Asia-Pacific Anycast', 'BGP Optimized'],
    description: 'Alibaba secondary nameserver.',
    location: 'Asia-Pacific / Global Anycast'
  },
  {
    id: '114dns-primary',
    name: '114DNS',
    provider: '114DNS',
    ip: '114.114.114.114',
    secondaryIp: '114.114.115.115',
    category: 'regional',
    features: ['Asia Backbone', 'Massive Uptime', 'Anti-Hijacking'],
    description: 'Massive carrier-neutral public DNS resolver in Asia.',
    location: 'Asia-Pacific'
  },
  {
    id: 'yandex-primary',
    name: 'Yandex Basic DNS',
    provider: 'Yandex',
    ip: '77.88.8.8',
    secondaryIp: '77.88.8.1',
    category: 'regional',
    features: ['European Anycast', 'High Reliability'],
    description: 'High-speed public DNS server operated by Yandex.',
    location: 'Europe / CIS'
  }
];

/**
 * Benchmark a single DNS resolver
 */
async function testResolver(resolverInfo, domain = 'google.com', timeoutMs = 2500) {
  const resolver = new dns.promises.Resolver();
  resolver.setServers([resolverInfo.ip]);

  const t0 = performance.now();
  try {
    const resolvePromise = resolver.resolve4(domain);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    );

    const ips = await Promise.race([resolvePromise, timeoutPromise]);
    const latency = Math.round((performance.now() - t0) * 10) / 10;

    return {
      ...resolverInfo,
      status: 'UP',
      latencyMs: latency,
      resolvedIps: ips || [],
      error: null
    };
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT' || err.code === 'ETIMEOUT';
    return {
      ...resolverInfo,
      status: isTimeout ? 'TIMEOUT' : 'ERROR',
      latencyMs: null,
      resolvedIps: [],
      error: err.code || err.message
    };
  }
}

/**
 * Run full benchmark across all (or filtered) resolvers simultaneously
 */
export async function runFullDnsBenchmark({
  domain = 'google.com',
  category = 'all',
  timeoutMs = 2500
} = {}) {
  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'google.com';

  let resolversToTest = DNS_RESOLVER_DIRECTORY;
  if (category && category !== 'all') {
    resolversToTest = DNS_RESOLVER_DIRECTORY.filter((r) => r.category === category);
  }

  const startTime = performance.now();

  // Run all parallel queries
  const rawResults = await Promise.all(
    resolversToTest.map((r) => testResolver(r, cleanDomain, timeoutMs))
  );

  const durationMs = Math.round(performance.now() - startTime);

  // Partition into successful and failed
  const successful = rawResults.filter((r) => r.status === 'UP');
  const failed = rawResults.filter((r) => r.status !== 'UP');

  // Sort successful by latency ascending (fastest first)
  successful.sort((a, b) => a.latencyMs - b.latencyMs);

  // Assign ranks and diff from fastest
  const fastestLatency = successful.length > 0 ? successful[0].latencyMs : null;

  const rankedSuccessful = successful.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    diffFromFastest: fastestLatency !== null ? Math.round((r.latencyMs - fastestLatency) * 10) / 10 : 0
  }));

  const rankedFailed = failed.map((r) => ({
    ...r,
    rank: null,
    diffFromFastest: null
  }));

  const allRanked = [...rankedSuccessful, ...rankedFailed];

  // Calculate statistics
  const latencies = rankedSuccessful.map((r) => r.latencyMs);
  const avgLatency =
    latencies.length > 0
      ? Math.round((latencies.reduce((sum, val) => sum + val, 0) / latencies.length) * 10) / 10
      : null;
  const minLatency = fastestLatency;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;

  // Identify Best Picks / Recommendations
  const fastestOverall = rankedSuccessful[0] || null;
  const fastestPrivacy =
    rankedSuccessful.find((r) => r.category === 'privacy' || r.features.includes('Zero-Logs')) || null;
  const fastestAdBlock =
    rankedSuccessful.find((r) => r.category === 'adblock' || r.features.includes('Ad-Blocking')) || null;
  const fastestSecurity =
    rankedSuccessful.find((r) => r.category === 'security' || r.features.includes('Threat Blocking')) || null;
  const fastestFamily =
    rankedSuccessful.find((r) => r.category === 'family' || r.features.includes('Adult Content Block')) || null;

  // Detect and benchmark current system DNS
  let currentSystemDns = null;
  try {
    const systemServers = dns.getServers();
    if (systemServers && systemServers.length > 0) {
      const sysIp = systemServers[0];
      const matchedKnown = DNS_RESOLVER_DIRECTORY.find((r) => r.ip === sysIp);
      const sysRes = await testResolver({
        id: 'current-system',
        name: matchedKnown ? `${matchedKnown.name} (Active OS DNS)` : `Current DNS (${sysIp})`,
        provider: matchedKnown ? matchedKnown.provider : 'Local OS / Gateway',
        ip: sysIp,
        category: 'current',
        features: matchedKnown ? matchedKnown.features : ['System Configured'],
        location: matchedKnown ? matchedKnown.location : 'Local Network'
      }, cleanDomain, timeoutMs);

      const speedDiffPercent = (sysRes.latencyMs && fastestLatency && sysRes.latencyMs > fastestLatency)
        ? Math.round(((sysRes.latencyMs - fastestLatency) / sysRes.latencyMs) * 100)
        : 0;

      currentSystemDns = {
        ...sysRes,
        systemServers,
        speedDiffPercent,
        isFastest: sysRes.latencyMs && fastestLatency ? sysRes.latencyMs <= fastestLatency : false
      };
    }
  } catch (err) {
    console.warn('System DNS probe notice:', err.message);
  }

  return {
    testedDomain: cleanDomain,
    timestamp: new Date().toISOString(),
    totalTested: resolversToTest.length,
    successCount: rankedSuccessful.length,
    failedCount: rankedFailed.length,
    benchmarkDurationMs: durationMs,
    currentSystemDns,
    stats: {
      minLatency,
      avgLatency,
      maxLatency
    },
    recommendations: {
      fastestOverall,
      fastestPrivacy,
      fastestAdBlock,
      fastestSecurity,
      fastestFamily
    },
    resolvers: allRanked
  };
}
