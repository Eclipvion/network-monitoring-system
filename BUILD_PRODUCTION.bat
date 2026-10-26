@echo off
title NetPulse NOC - Production Builder
color 0A
echo =======================================================================
echo          NETPULSE NOC - PRODUCTION FRONTEND \u0026 BACKEND BUILDER
echo =======================================================================
echo.
echo [1/3] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Installing/verifying production dependencies...
call npm run install:server
call npm run install:client

echo.
echo [3/3] Compiling React frontend into production bundle (client/dist)...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo =======================================================================
    echo [SUCCESS] Production build generated successfully in client\dist\
    echo You can now run: START_PRODUCTION_SERVER.bat
    echo =======================================================================
) else (
    color 0C
    echo.
    echo [ERROR] Production build failed. Review the logs above.
)

echo.
pause
