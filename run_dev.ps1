#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run backend and frontend in development/watch mode
.DESCRIPTION
    Starts the FastAPI backend with auto-reload and Vite frontend in watch mode
    Both run concurrently with live reloading
#>

param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 5010,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Stop-StreamcraftPythonProcesses {
    Write-Host "`n🧹 Cleaning up existing Python processes..." -ForegroundColor Yellow
    
    # Find all python.exe processes running uvicorn or streamcraft
    $pythonProcs = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmdLine -and ($cmdLine -like "*uvicorn*" -or $cmdLine -like "*streamcraft*")
    }
    
    if ($pythonProcs) {
        $pythonProcs | ForEach-Object {
            Write-Host "  Stopping Python process (PID $($_.Id))" -ForegroundColor Gray
            try {
                Stop-Process -Id $_.Id -Force -ErrorAction Stop
            }
            catch {
                Write-Host "  ⚠️  Could not stop PID $($_.Id)`: $($_)" -ForegroundColor DarkYellow
            }
        }
        # Give processes time to clean up
        Start-Sleep -Milliseconds 500
    }
}

function Stop-ProcessOnPort {
    param(
        [int]$Port,
        [string]$Label
    )

    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop
    }
    catch {
        return
    }

    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 }
    if (-not $pids) { return }

    Write-Host "🛑 Stopping existing $Label process on port $Port (PID(s): $($pids -join ', '))" -ForegroundColor Yellow
    foreach ($processId in $pids) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
        }
        catch {
            Write-Host "⚠️  Could not stop PID $processId`: $($_)" -ForegroundColor DarkYellow
        }
    }
}

Write-Host "`n🚀 StreamCraft TTS - Development Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray

# Check Python venv
$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "❌ Python venv not found at .venv\" -ForegroundColor Red
    Write-Host "   Run: python -m venv .venv && .venv\Scripts\pip install -e backend" -ForegroundColor Yellow
    exit 1
}

# Check frontend
$frontendDir = Join-Path $root "frontend"
$frontendNodeModules = Join-Path $frontendDir "node_modules"
if (-not (Test-Path $frontendNodeModules)) {
    Write-Host "❌ Frontend dependencies not installed" -ForegroundColor Red
    Write-Host "   Run: cd frontend && npm install" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n📦 Configuration:" -ForegroundColor White
Write-Host "  Backend:  http://$BackendHost`:$BackendPort" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor Gray
Write-Host "  API Docs: http://$BackendHost`:$BackendPort/docs" -ForegroundColor Gray
Write-Host ""

# Clean up any lingering Python processes first
Stop-StreamcraftPythonProcesses

# Stop any existing servers bound to our dev ports
Stop-ProcessOnPort -Port $BackendPort -Label "backend (python/uvicorn)"
Stop-ProcessOnPort -Port $FrontendPort -Label "frontend (npm/vite)"

# Start backend in background
Write-Host "🔧 Starting backend (uvicorn with auto-reload)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($backendDir, $pythonExe, $hostname, $port)
    $ErrorActionPreference = 'Continue'
    Set-Location $backendDir
    $pythonScripts = Split-Path -Parent $pythonExe
    $venvRoot = Split-Path -Parent $pythonScripts
    $env:VIRTUAL_ENV = $venvRoot
    $env:PATH = "$pythonScripts;$env:PATH"
    $env:PYTHONHOME = ""
    $env:PYTHONUNBUFFERED = "1"
    & $pythonExe -m uvicorn streamcraft.infrastructure.web.fastapi.app:app --reload --host $hostname --port $port 2>&1
} -ArgumentList (Join-Path $root "backend"), $pythonExe, $BackendHost, $BackendPort

# Wait a moment and check if job started successfully
Start-Sleep -Seconds 1
if ($backendJob.State -eq 'Failed') {
    Write-Host "❌ Backend job failed to start" -ForegroundColor Red
    $backendError = Receive-Job -Job $backendJob 2>&1
    if ($backendError) {
        Write-Host "Error details:" -ForegroundColor Yellow
        $backendError | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Red
        }
    }
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    exit 1
}

Start-Sleep -Seconds 2

# Start frontend in background
Write-Host "⚡ Starting frontend (Vite with HMR)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($frontendDir, $port)
    Set-Location $frontendDir
    $env:VITE_PORT = $port
    npm run dev
} -ArgumentList $frontendDir, $FrontendPort

Start-Sleep -Seconds 2

Write-Host "`n✅ Development servers started!" -ForegroundColor Green
Write-Host "`n📖 Usage:" -ForegroundColor White
Write-Host "  • Open http://localhost:$FrontendPort in your browser" -ForegroundColor Gray
Write-Host "  • Backend API docs at http://$BackendHost`:$BackendPort/docs" -ForegroundColor Gray
Write-Host "  • Press Ctrl+C to stop both servers" -ForegroundColor Gray
Write-Host ""

# Wait and stream logs
try {
    Write-Host "📋 Logs (Ctrl+C to stop):" -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
    
    while ($true) {
        # Show backend logs
        $backendOutput = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        if ($backendOutput) {
            $backendOutput | ForEach-Object {
                Write-Host "[Backend] $_" -ForegroundColor Blue
            }
        }
        
        # Show frontend logs
        $frontendOutput = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        if ($frontendOutput) {
            $frontendOutput | ForEach-Object {
                Write-Host "[Frontend] $_" -ForegroundColor Magenta
            }
        }
        
        # Check if jobs are still running
        if ($backendJob.State -eq 'Failed') {
            Write-Host "`n❌ Backend server failed" -ForegroundColor Red
            $backendError = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue 2>&1
            if ($backendError) {
                Write-Host "Backend error:" -ForegroundColor Yellow
                $backendError | ForEach-Object {
                    Write-Host "  $_" -ForegroundColor Red
                }
            }
            break
        }
        if ($frontendJob.State -eq 'Failed') {
            Write-Host "`n❌ Frontend server failed" -ForegroundColor Red
            $frontendError = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue 2>&1
            if ($frontendError) {
                Write-Host "Frontend error:" -ForegroundColor Yellow
                $frontendError | ForEach-Object {
                    Write-Host "  $_" -ForegroundColor Red
                }
            }
            break
        }
        
        Start-Sleep -Milliseconds 100
    }
}
finally {
    Write-Host "`n🛑 Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Servers stopped" -ForegroundColor Green
}
