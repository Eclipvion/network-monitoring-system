import express from 'express';
import net from 'net';
import tls from 'tls';
import { promises as dnsPromises } from 'dns';
import dataStore from '../services/dataStore.js';
import { broadcastDomainHealthUpdated } from '../websocket/socketHandler.js';

const router = express.Router();

/**
 * Native Socket WHOIS Query via TCP Port 43
 */
export function queryWhoisServer(domain, server = 'whois.verisign-grs.com') {
  return new Promise((resolve) => {
    const socket = net.createConnection(43, server, () => {
      socket.write(domain + '\r\n');
    });
    let data = '';
    socket.on('data', (chunk) => { data += chunk.toString(); });
    socket.on('end', () => resolve(data));
    socket.on('error', () => resolve(''));
    socket.setTimeout(6000, () => {
      socket.destroy();
      resolve(data);
    });
  });
}

export function getRootDomain(rawDomain) {
  const clean = String(rawDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0];

  const parts = clean.split('.');
  if (parts.length <= 2) return clean;
  const secondLast = parts[parts.length - 2];
  if (['com', 'co', 'org', 'net', 'edu', 'gov'].includes(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Built-In Recursive WHOIS Parser
 * Extracts Domain Registration Created Date, Updated Date, Expiration Date, and Registrar.
 */
export async function lookupDomainWhois(rawDomain) {
  const fullDomain = String(rawDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0];

  // WHOIS registries require root domain (e.g. facebook.com instead of www.facebook.com)
  const domain = getRootDomain(fullDomain);
  const tld = domain.split('.').pop();

  // Route to authoritative registry WHOIS server
  let server = 'whois.verisign-grs.com';
  if (tld === 'org') server = 'whois.pir.org';
  else if (tld === 'io') server = 'whois.nic.io';
  else if (tld === 'net') server = 'whois.verisign-grs.com';
  else if (tld === 'pk') server = 'whois.pknic.net.pk';
  else if (tld !== 'com') {
    const ianaData = await queryWhoisServer(domain, 'whois.iana.org');
    const referMatch = ianaData.match(/refer:\s*([^\s]+)/i) || ianaData.match(/whois:\s*([^\s]+)/i);
    if (referMatch) server = referMatch[1];
  }

  let raw = await queryWhoisServer(domain, server);

  // If registrar WHOIS server is specified, query it for deeper customer registration details
  const registrarServerMatch = raw.match(/Registrar WHOIS Server:\s*([^\r\n]+)/i);
  if (registrarServerMatch && registrarServerMatch[1].trim()) {
    const regServer = registrarServerMatch[1].trim();
    if (regServer !== server) {
      const regRaw = await queryWhoisServer(domain, regServer);
      if (regRaw && regRaw.length > 80) {
        raw = regRaw + '\n\n' + raw;
      }
    }
  }

  const createdMatch = raw.match(/(?:Creation Date|Created On|Created|registered|Registration Time):\s*([^\r\n]+)/i);
  const updatedMatch = raw.match(/(?:Updated Date|Last Updated On|Updated|last-modified):\s*([^\r\n]+)/i);
  const expiryMatch = raw.match(/(?:Registry Expiry Date|Registrar Registration Expiration Date|Expir\w+ Date|Expires On|Expires|expires):\s*([^\r\n]+)/i);
  const registrarMatch = raw.match(/(?:Registrar Name|Registrar|registrar-name|Sponsoring Registrar):\s*([^\r\n]+)/i);

  let domainDaysRemaining = null;
  let domainExpires = null;
  let domainCreated = null;
  let domainUpdated = null;

  if (expiryMatch) {
    const d = new Date(expiryMatch[1].trim());
    if (!isNaN(d.getTime())) {
      domainExpires = d.toISOString();
      const diff = d.getTime() - Date.now();
      domainDaysRemaining = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
    } else {
      domainExpires = expiryMatch[1].trim();
    }
  }

  if (createdMatch) {
    const d = new Date(createdMatch[1].trim());
    domainCreated = !isNaN(d.getTime()) ? d.toISOString() : createdMatch[1].trim();
  }

  if (updatedMatch) {
    const d = new Date(updatedMatch[1].trim());
    domainUpdated = !isNaN(d.getTime()) ? d.toISOString() : updatedMatch[1].trim();
  }

  return {
    domainRegistrar: registrarMatch ? registrarMatch[1].trim() : 'Unknown Registrar',
    domainCreated,
    domainUpdated,
    domainExpires,
    domainDaysRemaining,
    whoisRaw: raw.slice(0, 4000)
  };
}

/**
 * Built-In DNS Records Lookup (A, NS, MX)
 */
export async function lookupDnsRecords(cleanDomain) {
  let allIps = [];
  let nameServers = [];
  let mailServers = [];

  try {
    const ips = await dnsPromises.resolve4(cleanDomain);
    allIps = ips || [];
  } catch (e) {}

  try {
    const ns = await dnsPromises.resolveNs(cleanDomain);
    nameServers = ns || [];
  } catch (e) {}

  try {
    const mx = await dnsPromises.resolveMx(cleanDomain);
    mailServers = (mx || []).map((m) => m.exchange);
  } catch (e) {}

  return {
    allIps,
    nameServers,
    mailServers,
    dnsResolved: allIps.length > 0,
    resolvedIp: allIps[0] || null
  };
}

/**
 * Comprehensive Native Domain Health & Security Probe
 * Inspects:
 * 1. Domain Registration Expiration (WHOIS)
 * 2. SSL/TLS Certificate Expiration & Details
 * 3. DNS Records (A, NS, MX)
 * 4. HTTP/HTTPS Web Status & Latency
 */
export async function probeDomainHealth(rawDomain) {
  const cleanDomain = String(rawDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0];

  if (!cleanDomain) {
    throw new Error('Valid domain name is required');
  }

  // 1. DNS Resolution (A, NS, MX Records)
  const dnsData = await lookupDnsRecords(cleanDomain);

  // 2. Built-in WHOIS Lookup (Domain Name Registration Dates)
  let whoisData = {
    domainRegistrar: null,
    domainCreated: null,
    domainUpdated: null,
    domainExpires: null,
    domainDaysRemaining: null,
    whoisRaw: null
  };
  try {
    whoisData = await lookupDomainWhois(cleanDomain);
  } catch (e) {
    console.warn(`WHOIS lookup failed for ${cleanDomain}:`, e.message);
  }

  // 3. SSL Certificate Inspection (Web Security Certificate)
  let sslValid = false;
  let sslExpiresAt = null;
  let sslDaysRemaining = null;
  let sslIssuer = null;
  let sslSubject = null;
  let sslProtocol = null;

  try {
    await new Promise((resolve) => {
      const socket = tls.connect(
        443,
        cleanDomain,
        { servername: cleanDomain, timeout: 5000 },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            if (cert && cert.valid_to) {
              sslValid = socket.authorized !== undefined ? socket.authorized : true;
              sslExpiresAt = new Date(cert.valid_to).toISOString();
              const diffMs = new Date(cert.valid_to).getTime() - Date.now();
              sslDaysRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              sslIssuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Verified CA') : 'Verified CA';
              sslSubject = cert.subject ? (cert.subject.CN || cleanDomain) : cleanDomain;
              sslProtocol = socket.getProtocol ? socket.getProtocol() : 'TLS';
            }
          } catch (e) {}
          socket.destroy();
          resolve();
        }
      );
      socket.on('error', () => {
        socket.destroy();
        resolve();
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve();
      });
    });
  } catch (err) {}

  // 4. HTTP / HTTPS Web Reachability & Latency
  let httpStatus = null;
  let responseTimeMs = null;
  try {
    const start = Date.now();
    const res = await fetch(`https://${cleanDomain}`, {
      method: 'GET',
      headers: { 'User-Agent': 'NetPulse-DomainMonitor/2.0' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow'
    });
    responseTimeMs = Date.now() - start;
    httpStatus = res.status;
  } catch (err) {
    // If HTTPS failed, fallback try HTTP
    try {
      const start = Date.now();
      const res = await fetch(`http://${cleanDomain}`, {
        method: 'GET',
        headers: { 'User-Agent': 'NetPulse-DomainMonitor/2.0' },
        signal: AbortSignal.timeout(4000),
        redirect: 'follow'
      });
      responseTimeMs = Date.now() - start;
      httpStatus = res.status;
    } catch (e) {
      httpStatus = null;
      responseTimeMs = null;
    }
  }

  return {
    domain: cleanDomain,
    timestamp: new Date().toISOString(),
    httpStatus,
    responseTimeMs,
    sslValid,
    sslExpiresAt,
    sslDaysRemaining,
    sslIssuer,
    sslSubject,
    sslProtocol,
    domainCreated: whoisData.domainCreated,
    domainUpdated: whoisData.domainUpdated,
    domainExpires: whoisData.domainExpires,
    domainDaysRemaining: whoisData.domainDaysRemaining,
    domainRegistrar: whoisData.domainRegistrar,
    whoisRaw: whoisData.whoisRaw,
    dnsResolved: dnsData.dnsResolved,
    resolvedIp: dnsData.resolvedIp,
    allIps: dnsData.allIps,
    nameServers: dnsData.nameServers,
    mailServers: dnsData.mailServers
  };
}

// GET /api/domains - List all domains enriched with latest health & SSL status
router.get('/', async (req, res) => {
  try {
    const domains = await dataStore.getDomainsWithHealth();
    res.json(domains);
  } catch (err) {
    console.error('Error fetching domains:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains/quick-probe - Instant ad-hoc probe for any domain without saving
router.post('/quick-probe', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain name is required' });
    }
    const result = await probeDomainHealth(domain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains/check-all - Trigger instant fleet audit across all active domains
router.post('/check-all', async (req, res) => {
  try {
    const domains = await dataStore.getDomainsWithHealth();
    const activeDomains = domains.filter((d) => d.monitoring !== false);

    const checkPromises = activeDomains.map(async (d) => {
      try {
        const probe = await probeDomainHealth(d.domain);
        probe.domainId = Number(d.id);
        const saved = await dataStore.saveDomainHealthResult(probe);
        broadcastDomainHealthUpdated(saved);
        return { domainId: d.id, success: true, result: saved };
      } catch (err) {
        return { domainId: d.id, success: false, error: err.message };
      }
    });

    await Promise.all(checkPromises);
    const updated = await dataStore.getDomainsWithHealth();
    res.json({ success: true, totalChecked: activeDomains.length, domains: updated });
  } catch (err) {
    console.error('Error checking all domains:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains - Add new domain for monitoring
router.post('/', async (req, res) => {
  try {
    const { domain, interval, monitoring } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }

    const created = await dataStore.addDomain({
      domain,
      interval: interval ? Number(interval) : 3600,
      monitoring: monitoring !== undefined ? Boolean(monitoring) : true
    });

    // Immediately probe domain with WHOIS & SSL
    probeDomainHealth(created.domain)
      .then(async (probe) => {
        probe.domainId = Number(created.id);
        const saved = await dataStore.saveDomainHealthResult(probe);
        broadcastDomainHealthUpdated(saved);
      })
      .catch((e) => {
        console.warn('Initial probe failed for new domain:', created.domain, e.message);
      });

    res.status(201).json(created);
  } catch (err) {
    console.error('Error adding domain:', err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/domains/:id - Update domain settings
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateDomain(id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('Error updating domain:', err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/domains/:id - Delete domain
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataStore.deleteDomain(id);
    res.json(result);
  } catch (err) {
    console.error('Error deleting domain:', err);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/domains/:id/history - Get health/latency history for a domain
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 100;
    const history = await dataStore.getDomainHealthHistory(id, limit);
    res.json(history);
  } catch (err) {
    console.error('Error fetching domain history:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains/:id/check-now - Trigger immediate health check for a single domain
router.post('/:id/check-now', async (req, res) => {
  try {
    const { id } = req.params;
    const domain = await dataStore.getDomainById(id);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const probe = await probeDomainHealth(domain.domain);
    probe.domainId = Number(domain.id);
    const saved = await dataStore.saveDomainHealthResult(probe);
    broadcastDomainHealthUpdated(saved);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
