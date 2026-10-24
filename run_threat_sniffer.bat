@echo off
chcp 65001 >nul
title NetPulse - Threat & DNS Search Sniffer
color 0C

set "ROOT=%~dp0"
cd /d "%ROOT%python-monitor"

set "PYTHON_CMD=python"
if exist "%ROOT%.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%ROOT%.venv\Scripts\python.exe"
) else if exist "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe"
)

echo =====================================================================
echo    NETPULSE CYBER THREAT & DNS TRAFFIC SNIFFER
echo =====================================================================
"%PYTHON_CMD%" threat_sniffer.py
pause
