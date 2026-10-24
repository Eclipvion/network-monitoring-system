@echo off
title NetPulse - Stop All Services
color 0C
echo =====================================================================
echo           STOPPING ALL NETPULSE MONITORING SERVICES
echo =====================================================================
echo.
echo Stopping Node.js processes (Server aur Vite Dashboard)...
taskkill /f /im node.exe >nul 2>&1

echo Stopping NetPulse Python engine...
taskkill /f /fi "WINDOWTITLE eq NetPulse*" >nul 2>&1

echo.
echo =====================================================================
echo    Tamam NetPulse services band ho chuki hain!
echo =====================================================================
timeout /t 3
exit
