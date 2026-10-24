@echo off
chcp 65001 >nul
title NetPulse - Network Monitoring System Launcher
color 0B

echo =====================================================================
echo           NETPULSE - NETWORK MONITORING SYSTEM LAUNCHER
echo =====================================================================
echo.
echo [1/3] Backend Server shuru ho raha hai... (Port 5000)
echo [2/3] React Dashboard shuru ho raha hai... (Port 5173)
echo [3/3] Python Monitoring Engine shuru ho raha hai...
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: Python executable check (venv -> local python312 -> system python)
set "PYTHON_CMD=python"
if exist "%ROOT%.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%ROOT%.venv\Scripts\python.exe"
) else if exist "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe"
)

:: 1. Launch Backend Server in its own separate window
start "NetPulse - [1] Backend Server" cmd /k "title NetPulse Backend Server (Port 5000) && cd /d "%ROOT%server" && npm.cmd start"

:: Thora delay taake server bind ho jaye
timeout /t 2 /nobreak >nul

:: 2. Launch Frontend React Dashboard in its own separate window
start "NetPulse - [2] React Dashboard" cmd /k "title NetPulse React Dashboard (Port 5173) && cd /d "%ROOT%client" && npm.cmd run dev"

:: Thora delay
timeout /t 2 /nobreak >nul

:: 3. Launch Python Monitor in its own separate window
start "NetPulse - [3] Python Monitor" cmd /k "title NetPulse Python Monitor && cd /d "%ROOT%python-monitor" && "%PYTHON_CMD%" monitor.py"

:: Wait 3 seconds and automatically open browser
timeout /t 3 /nobreak >nul
echo.
echo =====================================================================
echo    Mubarak ho! Tamam 3 terminals alag alag open ho chuke hain!
echo    Browser open kiya ja raha hai: http://localhost:5173
echo =====================================================================
start http://localhost:5173

exit
