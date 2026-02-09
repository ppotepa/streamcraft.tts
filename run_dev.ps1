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
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

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

# Start backend in background
Write-Host "🔧 Starting backend (uvicorn with auto-reload)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($root, $pythonExe, $host, $port)
    Set-Location (Join-Path $root "backend")
    & $pythonExe -m uvicorn streamcraft.infrastructure.web.fastapi.app:app --reload --host $host --port $port
} -ArgumentList $root, $pythonExe, $BackendHost, $BackendPort

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
        if ($backendJob.State -eq 'Failed' -or $frontendJob.State -eq 'Failed') {
            Write-Host "`n❌ One or more servers failed" -ForegroundColor Red
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
