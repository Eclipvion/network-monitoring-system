# NetPulse - Multi-Terminal Launcher (PowerShell)
$rootDir = $PSScriptRoot
Set-Location $rootDir

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "          NETPULSE - NETWORK MONITORING SYSTEM LAUNCHER             " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Backend Server shuru ho raha hai... (Port 5000)" -ForegroundColor Yellow
Write-Host "[2/3] React Dashboard shuru ho raha hai... (Port 5173)" -ForegroundColor Yellow
Write-Host "[3/3] Python Monitoring Engine shuru ho raha hai..." -ForegroundColor Yellow
Write-Host ""

# Determine Python executable
$pythonPath = "python"
if (Test-Path "$rootDir\.venv\Scripts\python.exe") {
    $pythonPath = "$rootDir\.venv\Scripts\python.exe"
} elseif (Test-Path "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe") {
    $pythonPath = "C:\Users\Ability\AppData\Local\Programs\Python\Python312\python.exe"
}

# 1. Start Backend Server in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='NetPulse Backend Server (Port 5000)'; Set-Location '$rootDir\server'; npm.cmd start"

Start-Sleep -Seconds 2

# 2. Start Frontend React Dashboard in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='NetPulse React Dashboard (Port 5173)'; Set-Location '$rootDir\client'; npm.cmd run dev"

Start-Sleep -Seconds 2

# 3. Start Python Monitoring Engine in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='NetPulse Python Monitor'; Set-Location '$rootDir\python-monitor'; & '$pythonPath' monitor.py"

Start-Sleep -Seconds 3

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "Tamam 3 services alag alag terminals me start ho chuki hain!" -ForegroundColor Green
Write-Host "Browser open kiya ja raha hai: http://localhost:5173" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
