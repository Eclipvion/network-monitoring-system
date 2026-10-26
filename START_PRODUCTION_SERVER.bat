@echo off
title NetPulse NOC - Unified Production Server (Port 5000)
color 0B
echo =======================================================================
echo              NETPULSE ENTERPRISE NOC - PRODUCTION RUNNER
echo =======================================================================
echo.

:: Check if client/dist exists, if not build it
if not exist "client\dist\index.html" (
    echo [NOTICE] client\dist build not found! Building production frontend first...
    call npm run build
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Frontend build failed! Aborting startup.
        pause
        exit /b 1
    )
)

echo [OK] Production frontend bundle verified (client\dist).
echo.

:: Display local IPv4 address
echo Detecting local server network IP...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"IP Address"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)

:found_ip
set LOCAL_IP=%LOCAL_IP: =%
echo -----------------------------------------------------------------------
echo  SERVER READY FOR OFFICE NETWORK ACCESS:
echo   - Local Access:     http://localhost:5000
if not "%LOCAL_IP%"=="" (
    echo   - Office LAN Access: http://%LOCAL_IP%:5000
)
echo -----------------------------------------------------------------------
echo.
echo Starting unified server (REST API + WebSockets + React Dashboard)...
echo Press Ctrl + C to stop the server at any time.
echo.

node server\server.js
pause
