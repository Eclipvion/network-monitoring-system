# Network Monitoring System (NetPulse)

A high-performance, custom Enterprise Network Monitoring System built with **React 18**, **Tailwind CSS 3**, **Recharts**, **Node.js 20+**, **Socket.IO 4**, and **Python 3.12**.

---

## 🌟 Key Features

1. **Infrastructure Dashboard**: Live overview of total monitored devices, healthy hosts (UP), degraded (WARNING), and outages (DOWN), along with real-time average latency and active alert counts.
2. **Device Management**:
   - Add, edit, and delete devices with live IPv4/IPv6 validation and duplicate IP rejection.
   - Configure individual ping intervals per host.
   - Pause or resume active monitoring per device with an instant toggle switch.
3. **Telemetry & Sensor Matrix**:
   - Real-time health matrix with color-coded sensor blocks (UP: Green, DOWN: Red, WARNING: Yellow, PAUSED: Slate).
   - Live telemetry feed stream connected via WebSockets (`device:status`, `alert:new`, `alert:resolved`).
4. **Historical Telemetry Charts**:
   - Interactive Recharts area chart with selectable time ranges (`1h`, `24h`, `7d`).
   - Roundtrip latency tracking, packet loss percentage, uptime calculation, and check history.
5. **Incident Alerts Engine**:
   - Automatically raises a DOWN alert when a host fails consecutive ping probes (`retryCountBeforeDown`).
   - Deduplicates alerts (does not create repeated DOWN alerts for unresolved outages).
   - Automatically marks alerts resolved with a RECOVERY event when the device returns to UP or WARNING.
   - Supports manual alert resolution.
6. **Audit & Activity Logs**:
   - Paginated historical logs for device configuration events, outages, recoveries, settings updates, and manual resolutions.
7. **Swappable Concurrency-Safe Data Layer**:
   - Stores data cleanly in `/data` using `JSONDataStore` protected by an in-memory asynchronous mutex.
   - Swappable interface (`BaseDataStore`) for simple transition to PostgreSQL in Phase 2 without modifying frontend or monitoring code.

---

## 🏗️ Architecture

```
React Dashboard (Vite :5173)  <---REST + Socket.IO--->  Node.js Server (:5000)  <---dataStore.js--->  /data/*.json
                                                              ^
                                                              | HTTP (POST /api/monitoring/result,
                                                              |       GET /api/devices,
                                                              |       GET /api/settings)
                                                              |
                                                    Python Monitoring Worker
```

The Python worker only communicates with the Node API over HTTP — it never accesses or modifies the JSON files directly.

---

## 📁 Project Structure

```
network-monitoring-system/
├── client/                     # React 18 + Tailwind CSS + Recharts Frontend
│   ├── src/
│   │   ├── components/         # Navbar, Sidebar, StatusBadge, Modals
│   │   ├── pages/              # Overview, Devices, Monitoring, Alerts, Logs, Settings
│   │   ├── services/           # api.js, socket.js
│   │   ├── App.jsx             # Main Application root with WebSocket listeners
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                     # Node.js + Express + Socket.IO Backend
│   ├── routes/                 # devices, dashboard, alerts, logs, monitoring, settings
│   ├── services/
│   │   └── dataStore.js        # JSONDataStore with async mutex concurrency queue
│   ├── websocket/
│   │   └── socketHandler.js    # Socket.IO broadcaster
│   ├── package.json
│   └── server.js               # Express application entry point
├── python-monitor/             # Python 3.12 Ping & Telemetry Engine
│   ├── monitor.py              # Main monitoring polling loop & ping probes
│   ├── config.py               # Worker configuration
│   └── requirements.txt        # requests, ping3, psutil, python-dotenv
├── data/                       # Temporary JSON file storage
│   ├── devices.json            # Monitored devices list (with initial test seeds)
│   ├── monitoring-results.json # Pruned telemetry results (max 500 per device / 7 days)
│   ├── alerts.json             # Active and resolved alerts
│   ├── settings.json           # Thresholds and retry configurations
│   └── logs.json               # System activity and audit events
├── .env                        # Environment configuration
├── .env.example
├── package.json                # Root orchestration scripts
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** (v20+ or v24+) and **npm**
- **Python** (v3.11+ or v3.12+)

---

### Step 1: Install Dependencies

#### 1. Backend Server
```bash
cd server
npm install
```

#### 2. Frontend Client
```bash
cd client
npm install
```

#### 3. Python Monitoring Worker
```bash
cd python-monitor
pip install -r requirements.txt
```

*(Or from root using the executable python path: `python -m pip install -r python-monitor/requirements.txt`)*

---

## 🏃 Running the System

You will run three terminal processes:

### Terminal 1: Node.js Backend Server
```bash
cd server
npm start
```
*Server starts on `http://localhost:5000` with WebSocket support.*

### Terminal 2: React Frontend Dashboard
```bash
cd client
npm run dev
```
*Access the dashboard in your browser at `http://localhost:5173`.*

### Terminal 3: Python Monitoring Worker
```bash
cd python-monitor
python monitor.py
```
*(On Windows if `python` is aliased: use `py monitor.py` or your Python 3.12 executable path).*

---

## ⚙️ Configuration & Thresholds (`.env`)

Configure the following variables in `.env`:

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
DATA_DIR=./data
PYTHON_WORKER_POLL_INTERVAL=10
```

### Dynamic Thresholds (Configurable in Settings UI or `/data/settings.json`):
- `defaultInterval`: Default ping interval in seconds (default: 30s)
- `latencyWarningThresholdMs`: Latency threshold in ms for WARNING status (default: 150ms)
- `packetLossWarningPercent`: Packet loss % threshold for WARNING status (default: 20%)
- `retryCountBeforeDown`: Consecutive probe failures before declaring host DOWN (default: 2)

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Aggregated dashboard stats & sensor overview |
| `GET` | `/api/devices` | Retrieve all configured devices |
| `POST` | `/api/devices` | Add new device (with IP format validation & duplicate check) |
| `PUT` | `/api/devices/:id` | Update device details or toggle monitoring |
| `DELETE` | `/api/devices/:id` | Delete device |
| `GET` | `/api/devices/:id/status` | Get device current status and uptime % |
| `GET` | `/api/devices/:id/history?range=1h\|24h\|7d` | Historical telemetry records |
| `GET` | `/api/alerts` | List all system alerts (active and resolved) |
| `POST` | `/api/alerts/:id/resolve` | Manually mark an alert resolved |
| `GET` | `/api/logs?page=&limit=&event=` | Paginated audit and incident logs |
| `POST` | `/api/monitoring/result` | Ingest monitoring results from Python worker |
| `GET` | `/api/settings` | Get threshold and interval settings |
| `PUT` | `/api/settings` | Update threshold settings |
