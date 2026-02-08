param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8010,
    [int]$UiPort = 5174,
    [string]$UiDir = "ui/react",
    [string]$PythonExe = ".venv\Scripts\python.exe"
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "🔧 Streamcraft TTS - Watch Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════" -ForegroundColor DarkGray

# Ensure Python venv exists
if (-not (Test-Path $PythonExe)) {
    Write-Host "[Setup] Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    if (-not $?) {
        throw "Failed to create virtual environment"
    }
}

# Install/update backend dependencies
Write-Host "`n[Backend] Checking Python dependencies..." -ForegroundColor Yellow
$backendPkgPath = Join-Path $root 'backend'
& .venv\Scripts\pip install -q -e $backendPkgPath
if ($LASTEXITCODE -eq 0) {
    Write-Host "[Backend] ✓ Dependencies ready" -ForegroundColor Green
} else {
    Write-Host "[Backend] ⚠ Dependency check failed, continuing anyway..." -ForegroundColor DarkYellow
}

# Ensure UI dependencies exist
$uiPath = Join-Path $root $UiDir
if (-not (Test-Path $uiPath)) {
    throw "UI directory not found: $uiPath"
}

$nodeModules = Join-Path $uiPath 'node_modules'
if (-not (Test-Path $nodeModules)) {
    Write-Host "`n[UI] Installing npm dependencies..." -ForegroundColor Yellow
    Push-Location $uiPath
    try {
        npm install
        Write-Host "[UI] ✓ Dependencies installed" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[UI] ✓ Dependencies ready" -ForegroundColor Green
}

# Start backend with auto-reload
$backendCmd = "$PythonExe -m uvicorn streamcraft.api.main:app --reload --host $BackendHost --port $BackendPort"

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════" -ForegroundColor DarkGray
Write-Host "🚀 Starting Development Servers" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════" -ForegroundColor DarkGray
Write-Host "[Backend] " -NoNewline -ForegroundColor Yellow
Write-Host "http://${BackendHost}:${BackendPort}" -ForegroundColor White
Write-Host "[UI]      " -NoNewline -ForegroundColor Yellow
Write-Host "http://localhost:$UiPort" -ForegroundColor White
Write-Host "═══════════════════════════════════`n" -ForegroundColor DarkGray

$backendJob = Start-Job -Name "streamcraft-backend" -ScriptBlock {
    param($cmd, $workDir, $pkgPath)
    Set-Location $workDir
    $env:PYTHONPATH = $pkgPath
    Invoke-Expression $cmd
} -ArgumentList $backendCmd, $root, $backendPkgPath

Write-Host "[Backend] Started (Job ID $($backendJob.Id))" -ForegroundColor Green
Write-Host "[Tip] View backend logs: " -NoNewline -ForegroundColor DarkGray
Write-Host "Receive-Job -Name streamcraft-backend -Keep" -ForegroundColor Cyan

function Stop-DevJob {
    param($job)
    if (-not $job) { return }
    $existing = Get-Job -Id $job.Id -ErrorAction SilentlyContinue
    if (-not $existing) { return }
    if ($existing.State -eq 'Running') {
        Stop-Job -Job $existing -Force -ErrorAction SilentlyContinue | Out-Null
        Wait-Job -Job $existing -ErrorAction SilentlyContinue | Out-Null
    }
    Receive-Job -Job $existing -ErrorAction SilentlyContinue | Out-Host
    Remove-Job -Job $existing -Force -ErrorAction SilentlyContinue | Out-Null
}

try {
    Push-Location $uiPath
    try {
        Write-Host "[UI] Starting Vite dev server with HMR..." -ForegroundColor Yellow
        Write-Host "`n[Watch Mode Active] " -NoNewline -ForegroundColor Green
        Write-Host "Press Ctrl+C to stop both servers.`n" -ForegroundColor DarkGray
        & npm run dev -- --host --port $UiPort
    } finally {
        Pop-Location
    }
} finally {
    Write-Host "`n[Shutdown] Stopping backend server..." -ForegroundColor Cyan
    Stop-DevJob $backendJob
    Write-Host "[Shutdown] Complete. Goodbye! 👋" -ForegroundColor Green
}
