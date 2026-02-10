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
    [int]$BackendPort = 5010,
    [int]$FrontendPort = 5173,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "`nStreamCraft TTS - Watch Mode" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor DarkGray

# Check Python venv
$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
$uvicornExe = Join-Path $root ".venv\Scripts\uvicorn.exe"

if (-not $FrontendOnly) {
    if (-not (Test-Path $pythonExe)) {
        Write-Host "Python venv not found" -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $uvicornExe)) {
        Write-Host "uvicorn not found, installing..." -ForegroundColor Yellow
        & $pythonExe -m pip install uvicorn[standard]
    }
}

# Check frontend
$frontendDir = Join-Path $root "frontend"
if (-not $BackendOnly) {
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Host "Frontend dependencies not installed" -ForegroundColor Red
        Write-Host "   Run: cd frontend && npm install" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`nWatch Configuration:" -ForegroundColor White
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
    Write-Host "Starting backend watcher..." -ForegroundColor Yellow
    $backendJob = Start-Job -ScriptBlock {
        param($backendDir, $uvicornExe, $hostname, $port)
        $ErrorActionPreference = 'Continue'
        Set-Location $backendDir
        $env:PYTHONUNBUFFERED = "1"
        # uvicorn with --reload watches Python files automatically
        & $uvicornExe streamcraft.infrastructure.web.fastapi.app:app `
            --reload `
            --reload-dir streamcraft `
            --host $hostname `
            --port $port `
            --log-level info 2>&1
    } -ArgumentList (Join-Path $root "backend"), $uvicornExe, $BackendHost, $BackendPort
    $jobs += $backendJob
    
    # Wait a moment and check if job started successfully
    Start-Sleep -Seconds 1
    if ($backendJob.State -eq 'Failed') {
        Write-Host "Backend job failed to start" -ForegroundColor Red
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
}

# Start frontend with Vite (has built-in HMR)
if (-not $BackendOnly) {
    Write-Host "Starting frontend watcher..." -ForegroundColor Yellow
    $frontendJob = Start-Job -ScriptBlock {
        param($frontendDir, $port)
        $ErrorActionPreference = 'Continue'
        Set-Location $frontendDir
        npm run dev -- --port $port --host 2>&1
    } -ArgumentList $frontendDir, $FrontendPort
    $jobs += $frontendJob
    
    # Wait a moment and check if job started successfully
    Start-Sleep -Seconds 1
    if ($frontendJob.State -eq 'Failed') {
        Write-Host "Frontend job failed to start" -ForegroundColor Red
        $frontendError = Receive-Job -Job $frontendJob 2>&1
        if ($frontendError) {
            Write-Host "Error details:" -ForegroundColor Yellow
            $frontendError | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Red
            }
        }
        Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
        exit 1
    }
    
    Start-Sleep -Seconds 2
}

Write-Host "`nWatch mode active!" -ForegroundColor Green
Write-Host "`nFeatures:" -ForegroundColor White
Write-Host "  - Backend auto-reloads on Python file changes" -ForegroundColor Gray
Write-Host "  - Frontend has Hot Module Replacement (HMR)" -ForegroundColor Gray
Write-Host "  - Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Monitor and stream logs
try {
    Write-Host "Live Logs:" -ForegroundColor Cyan
    Write-Host "-----------------------------------------" -ForegroundColor DarkGray
    
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
                    }
                    elseif ($_ -match 'warning') {
                        Write-Host "[Backend] $_" -ForegroundColor Yellow
                    }
                    else {
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
                    }
                    elseif ($_ -match 'warning') {
                        Write-Host "[Frontend] $_" -ForegroundColor Yellow
                    }
                    else {
                        Write-Host "[Frontend] $_" -ForegroundColor Magenta
                    }
                }
            }
            $lastFrontendCheck = $now
        }
        
        # Check if any job failed
        foreach ($job in $jobs) {
            if ($job.State -eq 'Failed') {
                $jobName = if ($job -eq $backendJob) { "Backend" } else { "Frontend" }
                Write-Host "`n$jobName server failed!" -ForegroundColor Red
                $jobError = Receive-Job -Job $job -ErrorAction SilentlyContinue 2>&1
                if ($jobError) {
                    Write-Host "$jobName error:" -ForegroundColor Yellow
                    $jobError | ForEach-Object {
                        Write-Host "  $_" -ForegroundColor Red
                    }
                }
                throw "$jobName server job failed"
            }
        }
        
        Start-Sleep -Milliseconds 50
    }
}
finally {
    Write-Host "`nStopping watchers..." -ForegroundColor Yellow
    foreach ($job in $jobs) {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Watchers stopped" -ForegroundColor Green
}
