@echo off
title NetPulse NOC - Allow Windows Firewall Port 5000
echo =======================================================================
echo          NETPULSE NOC - WINDOWS FIREWALL CONFIGURATION
echo =======================================================================
echo.
echo This script opens Inbound TCP Port 5000 so that other computers
echo and mobile devices in your office LAN can open the NetPulse Dashboard.
echo.
echo Requesting administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Please right-click this file and select "Run as administrator"!
    echo.
    pause
    exit /b 1
)

echo Adding Windows Firewall Rule for Port 5000...
netsh advfirewall firewall add rule name="NetPulse NOC Server (Port 5000)" dir=in action=allow protocol=TCP localport=5000 profile=any

if %errorlevel% equ 0 (
    echo.
    echo =======================================================================
    echo [SUCCESS] Windows Firewall Inbound Port 5000 is now ALLOWED!
    echo Any device on your office LAN can now visit:
    echo   http://^<YOUR-SERVER-IP^>:5000
    echo =======================================================================
) else (
    echo.
    echo [ERROR] Failed to add firewall rule. Please check Windows security settings.
)

echo.
pause
