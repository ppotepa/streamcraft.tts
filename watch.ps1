#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Watch mode for backend and frontend development
.DESCRIPTION
    Enhanced development mode with file watching and auto-reload
    Monitors Python files and TypeScript files for changes
#>

param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "`n👀 StreamCraft TTS - Watch Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray

# Check Python venv
$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
$uvicornExe = Join-Path $root ".venv\Scripts\uvicorn.exe"

if (-not $FrontendOnly) {
    if (-not (Test-Path $pythonExe)) {
        Write-Host "❌ Python venv not found" -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $uvicornExe)) {
        Write-Host "⚠️  uvicorn not found, installing..." -ForegroundColor Yellow
        & $pythonExe -m pip install uvicorn[standard]
    }
}

# Check frontend
$frontendDir = Join-Path $root "ui\react"
if (-not $BackendOnly) {
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Host "❌ Frontend dependencies not installed" -ForegroundColor Red
        Write-Host "   Run: cd frontend && npm install" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n📦 Watch Configuration:" -ForegroundColor White
if (-not $FrontendOnly) {
    Write-Host "  Backend:  http://$BackendHost`:$BackendPort (auto-reload)" -ForegroundColor Gray
}
if (-not $BackendOnly) {
    Write-Host "  Frontend: http://localhost:$FrontendPort (HMR)" -ForegroundColor Gray
}
Write-Host ""

$jobs = @()

# Start backend with watchfiles
if (-not $FrontendOnly) {
    Write-Host "🔧 Starting backend watcher..." -ForegroundColor Yellow
    $backendJob = Start-Job -ScriptBlock {
        param($root, $uvicornExe, $host, $port)
        Set-Location (Join-Path $root "backend")
        # uvicorn with --reload watches Python files automatically
        & $uvicornExe streamcraft.infrastructure.web.fastapi.app:app `
            --reload `
            --reload-dir streamcraft `
            --host $host `
            --port $port `
            --log-level info
    } -ArgumentList $root, $uvicornExe, $BackendHost, $BackendPort
    $jobs += $backendJob
    Start-Sleep -Seconds 2
}

# Start frontend with Vite (has built-in HMR)
if (-not $BackendOnly) {
    Write-Host "⚡ Starting frontend watcher..." -ForegroundColor Yellow
    $frontendJob = Start-Job -ScriptBlock {
        param($frontendDir, $port)
        Set-Location $frontendDir
        npm run dev -- --port $port --host
    } -ArgumentList $frontendDir, $FrontendPort
    $jobs += $frontendJob
    Start-Sleep -Seconds 2
}

Write-Host "`n✅ Watch mode active!" -ForegroundColor Green
Write-Host "`n📖 Features:" -ForegroundColor White
Write-Host "  • Backend auto-reloads on Python file changes" -ForegroundColor Gray
Write-Host "  • Frontend has Hot Module Replacement (HMR)" -ForegroundColor Gray
Write-Host "  • Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Monitor and stream logs
try {
    Write-Host "📋 Live Logs:" -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
    
    $lastBackendCheck = Get-Date
    $lastFrontendCheck = Get-Date
    
    while ($true) {
        $now = Get-Date
        
        # Stream backend logs (throttled)
        if ((-not $FrontendOnly) -and ($now - $lastBackendCheck).TotalMilliseconds -gt 50) {
            $backendOutput = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
            if ($backendOutput) {
                $backendOutput | ForEach-Object {
                    if ($_ -match 'error|exception|failed') {
                        Write-Host "[Backend] $_" -ForegroundColor Red
                    } elseif ($_ -match 'warning') {
                        Write-Host "[Backend] $_" -ForegroundColor Yellow
                    } else {
                        Write-Host "[Backend] $_" -ForegroundColor Blue
                    }
                }
            }
            $lastBackendCheck = $now
        }
        
        # Stream frontend logs (throttled)
        if ((-not $BackendOnly) -and ($now - $lastFrontendCheck).TotalMilliseconds -gt 50) {
            $frontendOutput = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
            if ($frontendOutput) {
                $frontendOutput | ForEach-Object {
                    if ($_ -match 'error|failed') {
                        Write-Host "[Frontend] $_" -ForegroundColor Red
                    } elseif ($_ -match 'warning') {
                        Write-Host "[Frontend] $_" -ForegroundColor Yellow
                    } else {
                        Write-Host "[Frontend] $_" -ForegroundColor Magenta
                    }
                }
            }
            $lastFrontendCheck = $now
        }
        
        # Check if any job failed
        foreach ($job in $jobs) {
            if ($job.State -eq 'Failed') {
                Write-Host "`n❌ Server failed!" -ForegroundColor Red
                Receive-Job -Job $job -ErrorAction SilentlyContinue | Write-Host
                throw "Server job failed"
            }
        }
        
        Start-Sleep -Milliseconds 50
    }
}
finally {
    Write-Host "`n🛑 Stopping watchers..." -ForegroundColor Yellow
    foreach ($job in $jobs) {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Watchers stopped" -ForegroundColor Green
}
