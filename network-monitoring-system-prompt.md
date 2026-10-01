# Network Monitoring System — Build Prompt

Build a complete Network Monitoring System using Node.js + Python.

## Project Goal
Create a lightweight internal network monitoring system similar to a basic PRTG-style dashboard. Monitor network devices, servers, PCs and services, and show real-time status, latency, and monitoring history.

## Technology Stack & Versions
- Frontend: React 18, Tailwind CSS 3, Recharts
- Backend: Node.js 20+, Express.js 4, Socket.IO 4
- Monitoring Engine: Python 3.11+, ping3, psutil, requests
- Database: none yet — see JSON Data Layer below

## Database (Phase 1)
- DO NOT use PostgreSQL/MySQL/MongoDB yet.
- Use JSON files as a temporary database, stored in `/data`.
- All reads/writes MUST go through `/server/services/dataStore.js` — no route may touch the JSON files directly.
- `dataStore.js` MUST serialize writes (in-memory queue or async-mutex) to prevent race conditions/corruption when the Python worker and the API write concurrently.
- Design `dataStore.js` as a swappable interface (`JSONDataStore`) so a future `PostgreSQLDataStore` can replace it without touching frontend or monitoring code.

## JSON Files
```
/data/devices.json
/data/monitoring-results.json
/data/alerts.json
/data/settings.json
```

**devices.json entry:**
```json
{
  "id": 1,
  "name": "AD Server",
  "ip": "172.18.10.7",
  "type": "server",
  "monitoring": true,
  "interval": 30
}
```

**monitoring-results.json entry:**
```json
{
  "deviceId": 1,
  "timestamp": "ISO8601",
  "status": "UP",
  "latency": 12.4,
  "packetLoss": 0,
  "message": null
}
```
- Retention: keep only the last 500 results per device (or last 7 days, whichever is smaller); `dataStore.js` prunes on write.

**alerts.json entry:**
```json
{
  "id": "uuid",
  "deviceId": 1,
  "type": "DOWN",
  "timestamp": "ISO8601",
  "resolved": false
}
```
- Do not create a new DOWN alert for a device that already has an unresolved DOWN alert. Mark it resolved when a RECOVERY event is recorded.

**settings.json:**
```json
{
  "defaultInterval": 30,
  "latencyWarningThresholdMs": 150,
  "packetLossWarningPercent": 20,
  "retryCountBeforeDown": 2
}
```

## Status Logic
- **UP**: ping succeeds within threshold.
- **DOWN**: ping fails `retryCountBeforeDown` consecutive times.
- **WARNING**: device is UP but latency > `latencyWarningThresholdMs` OR packet loss > `packetLossWarningPercent`.

## Main Features
1. **Dashboard** — total devices, UP/DOWN counts, average latency, active alert count.
2. **Device Management** — add/edit/delete, enable/disable monitoring, fields: name, IP, type, interval. Validate IP format and reject duplicate IPs.
3. **Monitoring** — Python worker pings devices per their interval, measures latency/packet loss, determines status, and POSTs results to Node.
4. **Real-Time Dashboard** — Socket.IO pushes status changes to connected clients with no page refresh. Events: `device:status`, `alert:new`, `alert:resolved`.
5. **Device Details** — status, IP, latency, packet loss, uptime %, last check time, historical latency graph (selectable range: 1h/24h/7d), status history list.
6. **Alerts** — DOWN alert on failure, RECOVERY event on return, dedup per above, shown on dashboard.
7. **Logs** — timestamp, device, event, status, error message; paginated.

## Architecture
```
React Dashboard  <--REST + Socket.IO-->  Node.js Express Server  <--dataStore.js-->  /data/*.json
                                                    ^
                                                    | HTTP (POST /api/monitoring/result,
                                                    |       GET /api/devices)
                                                    |
                                          Python Monitoring Worker
```
The Python worker only talks to the Node API — it never touches the JSON files directly.

## Project Structure
```
network-monitoring-system/
├── client/
│   └── src/{components,pages,services,App.jsx}
├── server/
│   ├── routes/
│   ├── services/dataStore.js
│   ├── websocket/
│   └── server.js
├── python-monitor/
│   ├── monitor.py
│   ├── config.py
│   └── requirements.txt
├── data/{devices.json,monitoring-results.json,alerts.json,settings.json}
├── .env
├── .env.example
├── package.json
└── README.md
```

## UI Design
Professional dark/light IT monitoring dashboard. Sidebar: Overview, Devices, Alerts, Monitoring, Logs, Settings. Status colors: UP green, DOWN red, WARNING yellow. Cards for stats, charts for latency/history.

## API Endpoints
```
GET    /api/devices
POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id
GET    /api/devices/:id/status
GET    /api/devices/:id/history?range=1h|24h|7d
GET    /api/dashboard
GET    /api/alerts
POST   /api/alerts/:id/resolve
GET    /api/logs?page=&limit=
POST   /api/monitoring/result
```
Enable CORS for the client origin defined in `.env`.

## Python Worker
1. Poll `GET /api/devices` every N seconds (configurable).
2. Ping each IP per its own `interval`, apply `retryCountBeforeDown` before flagging DOWN.
3. Measure latency and packet loss.
4. POST result to `/api/monitoring/result`.
5. No frontend/dashboard logic in the worker — data only.

## Initial Test Devices
```
AD Server - 172.18.10.7
Sharing Server - 172.18.10.9
Test PC - 172.18.10.189
```
Seed these in devices.json behind a clear comment/flag so they're easy to delete later.

## .env.example
```
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
DATA_DIR=./data
PYTHON_WORKER_POLL_INTERVAL=10
```

## Development Requirements
- Provide install commands for client, server, and python-monitor separately.
- Provide start commands for Node server, React dev server, and Python worker.
- Provide README.md covering setup, running all three components, and folder purpose.
- Clean, modular, maintainable code. Do not over-engineer — this is the JSON-file MVP; PostgreSQL migration comes later via the `dataStore.js` interface only.
