================================================================================
          NETPULSE - NETWORK MONITORING SYSTEM (STEP BY STEP GUIDE)
================================================================================

Yeh guide aapko batayegi ke pura project (Backend Server, React Dashboard, 
aur Python Monitoring Engine) kaise run karna hai aur browser me kaise dekhna hai.

Poore system ko chalane ke liye aapko 3 alag alag Terminals (CMD ya PowerShell) 
kholne honge.

--------------------------------------------------------------------------------
STEP 1: BACKEND SERVER CHALANA (Terminal 1)
--------------------------------------------------------------------------------

1. Pehla Terminal (PowerShell ya Command Prompt) open karein.
2. Server ke folder me jayein:
   cd "c:\Users\Ability\Desktop\Network Monitoring System\server"

3. (Sirf pehli baar) Dependencies install karein agar pehle nahi ki:
   npm install
   (Agar PowerShell script error de to run karein: npm.cmd install)

4. Server start karein:
   npm start
   (ya npm.cmd start)

Aapko screen par yeh output nazar aayega:
===============================================
🚀 Network Monitoring Server running on port 5000
📡 WebSocket ready
🌐 Client Origin: http://localhost:5173
📁 Data Directory: ./data
===============================================

Is terminal ko BAND NA KAREIN, isko chalta rehne dein!


--------------------------------------------------------------------------------
STEP 2: FRONTEND DASHBOARD CHALANA AUR DEKHNA (Terminal 2)
--------------------------------------------------------------------------------

1. Doosra naya Terminal (PowerShell ya CMD) open karein.
2. Client ke folder me jayein:
   cd "c:\Users\Ability\Desktop\Network Monitoring System\client"

3. (Sirf pehli baar) Dependencies install karein agar pehle nahi ki:
   npm install
   (ya npm.cmd install)

4. React Dev Server start karein:
   npm run dev
   (ya npm.cmd run dev)

Aapko screen par yeh message milega:
  VITE v5.4.21  ready in ... ms
  ➜  Local:   http://localhost:5173/

5. AB APNE BROWSER ME DEKHEIN:
   Apna browser (Google Chrome, Edge, ya Brave) open karein aur address bar me 
   yeh URL likh kar Enter karein:
   http://localhost:5173

Ab aapko samne "NetPulse" ka real-time dark/light monitoring dashboard 
nazar aayega!


--------------------------------------------------------------------------------
STEP 3: PYTHON MONITORING ENGINE CHALANA (Terminal 3)
--------------------------------------------------------------------------------

Yeh engine background me devices ko ping karta hai aur live data server ko bhejta hai.

1. Teesra naya Terminal (PowerShell ya CMD) open karein.
2. Python-monitor folder me jayein:
   cd "c:\Users\Ability\Desktop\Network Monitoring System\python-monitor"

3. (Agar pehle requirements install nahi kiye to run karein):
   pip install -r requirements.txt

4. Python Monitor ko run karein:
   python monitor.py

   *NOTE (Agar PowerShell me 'python' na mile ya path space error aaye):*
   Aap direct Python 3.12 ka path use kar sakte hain:
   & "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe" monitor.py

Aapko screen par live pinging show hogi:
==================================================
🚀 Python Network Monitoring Engine Started
📡 API Endpoint: http://localhost:5000/api
⏱️ Poll Interval: 10s
🔍 Ping Probes per Check: 3
==================================================
[UP] Sharing Server (172.18.10.9) - Latency: 12ms | Loss: 0% ...


--------------------------------------------------------------------------------
DASHBOARD PAR KYA KYA DEKH SAKTE HAIN:
--------------------------------------------------------------------------------

1. "Overview" Tab:
   - Total Devices, UP/DOWN/WARNING counts.
   - Average network roundtrip latency graph.
   - Active critical outage alerts.

2. "Devices" Tab:
   - Monitored devices ki list.
   - "Add New Device" button dabayein: Naya device ka Name aur IP enter karein.
   - Har device ko "Active / Paused" switch se live pause ya resume kar sakte hain.
   - Edit aur Delete bhi kar sakte hain.

3. "Live Monitoring" Tab:
   - Color-coded sensor boxes (Green = UP, Red = DOWN, Yellow = WARNING).
   - Side me live WebSocket telemetry feed real-time me update hoti nazar aayegi 
     (page refresh karne ki zaroorat nahi padti).

4. "Alerts" Tab:
   - Agar koi device consecutive pings fail karega to DOWN alert ban jayega.
   - Jab device wapas theek hoga to automatically RECOVERY hokar resolve ho jayega.
   - Aap khud bhi "Mark Resolved" button se alert resolve kar sakte hain.

5. "Logs" Tab:
   - Purane tamam audit aur outage logs pagination ke sath dekh sakte hain.

6. "Settings" Tab:
   - Default ping interval, latency warning ms, packet loss %, aur retry count 
     apni marzi se change kar ke "Save Configuration" kar sakte hain.


--------------------------------------------------------------------------------
COMMON ERRORS AUR UNKA HAL:
--------------------------------------------------------------------------------

Q1: "The term 'c:\Users\Ability\Desktop\Network' is not recognized..."
Hal: Folder ke name me space hai ("Network Monitoring System"). PowerShell me 
     hamesha path ko quotes (" ") me likhein aur shuru me '&' lagayein:
     & "c:\Users\Ability\Desktop\Network Monitoring System\..."

Q2: "npm : File npm.ps1 cannot be loaded because running scripts is disabled..."
Hal: PowerShell me 'npm' ki jagah 'npm.cmd' likhein:
     npm.cmd start
     npm.cmd run dev

Q3: "A new release of pip is available: 25.0.1 -> 26.2.1"
Hal: Yeh sirf ek informational warning hai, koi error nahi hai. Agar update karna ho:
     & "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe" -m pip install --upgrade pip

================================================================================
Mubarak ho! Aapka Network Monitoring System mukammal ready hai.
================================================================================
