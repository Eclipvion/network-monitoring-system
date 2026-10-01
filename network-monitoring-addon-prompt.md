# Network Monitoring System — Addendum Prompt (Advanced Monitoring Features)

This is an ADDITION to the existing Network Monitoring System build (React + Node.js + Python, JSON file data layer). Do not rebuild the existing project — extend it using the same architecture: `dataStore.js` as the only access point to JSON files, Socket.IO for live updates, Python worker for active checks.

## New / Updated Tabs

Add these to the sidebar, after "Monitoring":
- Monitoring (updated — see below)
- Diagnostics (new)
- DNS Performance (new)
- Domain Health (new)

---

## 1. Monitoring Tab — Filters + Report Export

### Filters (client-side or via query params, developer's choice — but must not require a full page reload)
- By device type: Server / PC / Router / Switch / Other (based on the `type` field already in devices.json)
- By status: UP / DOWN / WARNING
- By name or IP (search box)
- By date range (for history view)

### Report Export
- Add a "Download Report" button on the Monitoring tab.
- Export current filtered view as **CSV** (must-have) and **PDF** (nice-to-have if time allows).
- CSV columns: Device Name, IP, Type, Status, Latency (ms), Packet Loss (%), Last Checked.
- New endpoint:
```
GET /api/monitoring/export?format=csv&type=&status=&from=&to=
```
- Export logic lives in `/server/services/reportService.js`, reading through `dataStore.js` only — do not bypass the data layer for exports.

---

## 2. Diagnostics Tab — Traffic / Packet Loss / Traceroute

This is a separate tab from the main Monitoring tab, focused on live network path diagnostics rather than up/down status.

### 2.1 Packet Loss & Latency Graph (real-time)
- Reuses ping data already collected by the Python worker (latency + packetLoss from `monitoring-results.json`).
- Show a live line graph per selected device: latency over time + packet loss % over time, on the same timeline.
- This is a *view* on existing data — no new data collection needed for this part.

### 2.2 Traceroute (on-demand, not continuous)
- User selects a device (or enters a custom IP/hostname) and clicks "Run Traceroute."
- Backend calls the Python worker to execute a traceroute and returns the hop list.
- Do NOT persist traceroute results long-term — store only the last result per device in memory or a small rotating file (`/data/traceroute-cache.json`, max 1 result per device, overwritten each run).

**Traceroute result shape:**
```json
{
  "target": "172.18.10.7",
  "timestamp": "ISO8601",
  "hops": [
    { "hop": 1, "ip": "192.168.1.1", "latencyMs": 1.2 },
    { "hop": 2, "ip": "172.18.10.7", "latencyMs": 4.5 }
  ],
  "completed": true
}
```

**New endpoints:**
```
POST /api/diagnostics/traceroute      body: { target: "ip or hostname" }
GET  /api/diagnostics/traceroute/:target   (returns last cached result)
```

**Python worker addition (`python-monitor/traceroute.py`):**
- Use `scapy` or shell out to system `traceroute` (Linux/Mac) / `tracert` (Windows) via `subprocess`.
- Cap at 30 hops, 2-second timeout per hop.
- Return partial results if it times out rather than failing silently.

---

## 3. DNS Performance Tab

Goal: compare a fixed set of DNS resolvers to find which one is fastest **from the server's network location**, plus track DNS resolution health over time.

### Resolvers to test (configurable in settings.json)
- Google DNS — 8.8.8.8
- Cloudflare — 1.1.1.1
- Quad9 — 9.9.9.9
- Local/ISP DNS (read from server's own network config, or let user add manually)

### What it measures, per resolver
- Resolution time (ms) for a test set of domains (configurable list, default: `google.com`, `cloudflare.com`, and one of the user's own monitored domains)
- Success/failure of resolution
- Run this test on an interval (default every 5 minutes, configurable in settings.json)

### Data file: `/data/dns-results.json`
```json
{
  "resolver": "1.1.1.1",
  "resolverName": "Cloudflare",
  "domain": "google.com",
  "resolutionTimeMs": 14.2,
  "success": true,
  "timestamp": "ISO8601"
}
```
- Retention: keep last 200 results per resolver (same pruning approach as monitoring-results.json).

### UI
- Table/bar chart: average resolution time per resolver, updated live.
- Clearly highlight the fastest resolver ("Recommended DNS").
- Line graph: resolution time trend over the last 24h per resolver.

### New endpoints:
```
GET /api/dns/results
GET /api/dns/summary        (returns avg time + success rate per resolver, and the current fastest)
```

### Python worker addition (`python-monitor/dns_check.py`):
- Use Python's `dns.resolver` (dnspython library — add to requirements.txt) pointed at each resolver IP.
- Run on its own interval, independent of the ping monitoring loop.
- POST results to a new endpoint: `POST /api/dns/result`

---

## 4. Domain Health Tab

Goal: monitor domains (not just IP devices) — SSL certificate status, DNS resolution, and reachability.

### New device-like entity: domains, stored separately from devices.json
### Data file: `/data/domains.json`
```json
{
  "id": 1,
  "domain": "example.com",
  "monitoring": true,
  "interval": 3600
}
```

### Per-check result — `/data/domain-health-results.json`
```json
{
  "domainId": 1,
  "timestamp": "ISO8601",
  "httpStatus": 200,
  "responseTimeMs": 220,
  "sslValid": true,
  "sslExpiresAt": "ISO8601",
  "sslDaysRemaining": 47,
  "dnsResolved": true,
  "resolvedIp": "93.184.216.34"
}
```
- Retention: last 100 results per domain, same pruning pattern as other result files.

### Checks performed (on the domain's configured interval)
1. **DNS resolution** — does the domain resolve? To what IP?
2. **HTTP(S) ping** — response time and status code (follow redirects, use HTTPS by default).
3. **SSL certificate check** — validity, expiry date, days remaining. Flag WARNING when `sslDaysRemaining < 14`.

### UI
- Card per domain: green/yellow/red health indicator.
- SSL expiry countdown, prominently flagged if under 14 days.
- Response time history graph.
- Add/remove domain form (same pattern as device management: add, edit, delete, enable/disable).

### New endpoints:
```
GET    /api/domains
POST   /api/domains
PUT    /api/domains/:id
DELETE /api/domains/:id
GET    /api/domains/:id/history
POST   /api/domain-health/result
```

### Python worker addition (`python-monitor/domain_health.py`):
- Use `requests` for HTTP checks, `ssl` + `socket` for certificate inspection, `dns.resolver` for DNS.
- Add `python-whois` only if WHOIS expiry (registrar-level, separate from SSL expiry) is wanted — optional, flag as future enhancement if not needed for v1.
- POST results to `/api/domain-health/result`.

---

## Settings.json additions
```json
{
  "dnsResolvers": [
    { "name": "Google", "ip": "8.8.8.8" },
    { "name": "Cloudflare", "ip": "1.1.1.1" },
    { "name": "Quad9", "ip": "9.9.9.9" }
  ],
  "dnsTestDomains": ["google.com", "cloudflare.com"],
  "dnsCheckIntervalSeconds": 300,
  "sslWarningDaysThreshold": 14
}
```

## Notes for the build
- Keep each new concern (traceroute, DNS, domain health) in its own Python module and its own Express route file — do not cram everything into `monitor.py` / a single routes file.
- All new JSON files go through `dataStore.js` exactly like the existing ones — no direct `fs.readFile` calls in routes.
- Socket.IO: emit `dns:updated` and `domain:health:updated` events so the new tabs update live, same pattern as `device:status`.
- This addendum assumes the base system (devices, dashboard, alerts, logs) from the original prompt is already built — do not duplicate that work.
