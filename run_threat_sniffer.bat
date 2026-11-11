@echo off
chcp 65001 >nul
title NetPulse - Layer-2 User Search & Web Activity Agent
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%python-monitor"

set "PYTHON_CMD=python"
if exist "%ROOT%.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%ROOT%.venv\Scripts\python.exe"
) else if exist "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe"
)

set "SERVER_URL=http://localhost:5000"
if not "%~1"=="" set "SERVER_URL=%~1"

echo ========================================================================
echo    NETPULSE LAYER-2 USER SEARCHES ^& WEB ACTIVITY AGENT
echo ========================================================================
"%PYTHON_CMD%" search_activity_agent.py --server "%SERVER_URL%"
pause
