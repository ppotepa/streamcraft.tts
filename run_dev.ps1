param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8010,
    [int]$UiPort = 5174,
    [string]$UiDir = "ui/react",
    [string]$PythonExe = ".venv\\Scripts\\python.exe",
    [switch]$SkipUiInstall
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$uiPath = Join-Path $root $UiDir
if (-not (Test-Path $uiPath)) { throw "UI directory not found: $uiPath" }

if (-not (Test-Path $PythonExe)) {
    throw "Python interpreter not found at $PythonExe. Create a venv or pass -PythonExe."
}

$nodeModules = Join-Path $uiPath 'node_modules'
if (-not $SkipUiInstall -and -not (Test-Path $nodeModules)) {
    Write-Host "[UI] Installing npm dependencies..." -ForegroundColor Cyan
    Push-Location $uiPath
    try {
        npm install
    } finally {
        Pop-Location
    }
}

$backendCmd = "$PythonExe -m uvicorn streamcraft.api.main:app --reload --host $BackendHost --port $BackendPort"
$backendPkgPath = Join-Path $root 'backend'

Write-Host "[Backend] Launching FastAPI server at http://${BackendHost}:${BackendPort}" -ForegroundColor Yellow
Write-Host "[Backend] Command: $backendCmd" -ForegroundColor DarkGray

$backendJob = Start-Job -Name "streamcraft-backend" -ScriptBlock {
    param($cmd, $workDir, $pkgPath)
    Set-Location $workDir
    $env:PYTHONPATH = $pkgPath
    Invoke-Expression $cmd
} -ArgumentList $backendCmd, $root, $backendPkgPath

Write-Host "[Backend] Running as job ID $($backendJob.Id). Tail logs with: Receive-Job -Name streamcraft-backend -Keep" -ForegroundColor Green

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
        Write-Host "[UI] Starting Vite dev server on http://localhost:$UiPort" -ForegroundColor Yellow
        Write-Host "[Tip] Press Ctrl+C to stop both servers." -ForegroundColor DarkGray
        & npm run dev -- --host --port $UiPort
    } finally {
        Pop-Location
    }
} finally {
    Write-Host "`n[Dev] Shutting down backend..." -ForegroundColor Cyan
    Stop-DevJob $backendJob
}
