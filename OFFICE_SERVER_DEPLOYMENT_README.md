# 🏢 NetPulse Enterprise NOC — Office Server Production Deployment Guide

Yeh guide aapko step-by-step batati hai ke **NetPulse Network Monitoring System** ko apne **Office Server (Windows Server / PC)** par production mode me kaise deploy aur 24/7 run karna hai, taake office ke tamam computers aur mobile phones se dashboard access ho sakay.

---

## ⚡ Quick Summary (Single-Server Mode Kya Hai?)

Pehle development me aapko do alag terminals (`5000` for backend aur `5173` for Vite frontend) chalane padte thay. 
Ab humne **Unified Single-Server Mode** enable kar diya hai:
- React frontend ka production build (`client/dist`) generate hota hai.
- Node.js Express server (`server.js`) hi port `5000` par **Frontend Dashboard + REST API + Live WebSockets** sab kuch akathay serve karta hai.
- Office ke kisi bhi computer se sirf ek link open karna hoga: `http://<SERVER-IP>:5000`

---

## 🛠️ Requirements (Office Server Par Kya Chahiye)

1. **Operating System:** Windows Server 2016/2019/2022, Windows 10/11 Pro, ya Linux.
2. **Node.js:** Version 18 ya 20+ ([Download Node.js LTS](https://nodejs.org))
3. **Python (Optional):** Python 3.10+ (Agar advanced multi-threaded sniffer ya external probe workers chalane hon).

---

## 🚀 Step-by-Step Office Server Deployment

### STEP 1: Code Ko Office Server Par Copy Karein
Project ka folder apne office server ke kisi bhi drive me copy kar lein (e.g. `C:\NetPulse-NOC` ya Desktop par).

---

### STEP 2: Production Build Generate Karein (1-Click)
Folder ke andar mojood batch file par double-click karein:
👉 **`BUILD_PRODUCTION.bat`**

*Yeh script:*
- Server aur Client ke dependencies check/install karegi.
- React frontend ko ultra-fast minified bundle (`client/dist`) me build kar degi.

*(Command line se karna ho to: `npm run build:all`)*

---

### STEP 3: Windows Firewall Me Port 5000 Allow Karein (Zaroori)
Office ke doosre computers ko server se connect hone ke liye Windows Firewall ka port 5000 open hona chahiye.

👉 **`ALLOW_FIREWALL_PORT_5000.bat`** par **Right-click karein aur "Run as administrator"** select karein.

*Yeh script Windows Firewall me rule add kar degi: `NetPulse NOC Server (Port 5000) - ALLOW`.*

---

### STEP 4: Server Run Karein

#### Option A: 1-Click Interactive Console (Testing & Manual Run)
👉 **`START_PRODUCTION_SERVER.bat`** par double click karein!

Aapko screen par show hoga:
```
=======================================================================
             NETPULSE ENTERPRISE NOC - PRODUCTION RUNNER
=======================================================================
[OK] Production frontend bundle verified (client\dist).

Detecting local server network IP...
-----------------------------------------------------------------------
 SERVER READY FOR OFFICE NETWORK ACCESS:
  - Local Access:      http://localhost:5000
  - Office LAN Access:  http://172.18.1.10:5000 (Aapka Server IP)
-----------------------------------------------------------------------

🚀 Network Monitoring Server running on port 5000
📡 WebSocket ready
```

Ab office ke kisi bhi computer ya mobile browser me `http://<SERVER-IP>:5000` open karein!

---

#### Option B: 24/7 Background Service (PM2 - Recommended for Real Servers)
Agar aap chahte hain ke terminal window kholi na rakhni parhay aur server background me chalta rahay:

1. Server par global PM2 install karein:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-service
   ```
2. NetPulse start karein:
   ```cmd
   pm2 start ecosystem.config.cjs
   ```
3. Status check karein:
   ```cmd
   pm2 status
   ```
4. Auto-save taake reboot par khud on ho:
   ```cmd
   pm2 save
   ```

*PM2 ke faiday:*
- Agar computer restart ho to NetPulse khud start ho jata hai.
- Agar koi error aaye to 1 second me auto-restart kar deta hai.
- Background service ke tor par chalta hai, koi black terminal window samne nahi rehti.

---

## 💻 Office LAN Par Doosre PCs Se Access Kaise Karein?

1. Server PC ka Local IP address dekhein (e.g. `172.18.1.10`).
   *(Yeh janne ke liye server par CMD me `ipconfig` likhein).*
2. Office ke kisi bhi employee ya technician ke computer par browser (Chrome/Edge) kholein.
3. Address bar me likhein:
   ```
   http://172.18.1.10:5000
   ```
4. NetPulse Dashboard live open ho jayega aur tamam real-time sensors, latency graphs aur alarms sync honge!

---

## 📂 Data & Configuration Persistence

Tamam devices, alert history, logs, audit reports aur system settings `./data/` folder me JSON files me store hoti hain:
- `data/devices.json`: Monitored servers, routers, IPs.
- `data/settings.json`: Polling interval, ISP IP, SLA target, logo URL, webhooks.
- `data/alerts.json`: Active & resolved outage alerts.
- `data/logs.json`: System audit trail.

**Backup Lena:**
Aap Settings page me ja kar **"Download Backup JSON"** button se kisi bhi waqt pura backup download kar sakte hain, ya direct `./data/` folder copy kar sakte hain.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Kya internet band hone par bhi monitoring chalegi?**
**A:** Ji haan! Kyunke backend aapke office ke server par chal raha hai, internal LAN devices (`172.18.1.1`, switches, local servers) ki monitoring 100% chalti rahegi.

**Q: Gateway ping test fail kyun nahi hoga ab?**
**A:** Humne multi-layer ping engine (ARP Neighbor + ICMP + TCP) ko normalize kar diya hai. Ab gateway unreachable ka false error nahi aayega aur instant real latency display hogi.

**Q: Settings me changes save karne ke baad restart karna parhega?**
**A:** Nahi! Settings save hotay hi runtime me Node engine aur connected browsers me live apply ho jati hain.
