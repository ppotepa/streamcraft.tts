param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8010,
    [int]$UiPort = 5174,
    [switch]$SkipBackend
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Starting Streamcraft TTS (production mode)..." -ForegroundColor Cyan

# Check if built
$uiDist = Join-Path $root "ui\react\dist"
if (-not (Test-Path $uiDist) -and -not $SkipBackend) {
    Write-Warning "UI not built. Run .\build.ps1 first."
    exit 1
}

# Start backend
if (-not $SkipBackend) {
    Write-Host "`n[Backend] Starting API server on ${BackendHost}:${BackendPort}..." -ForegroundColor Yellow
    & .venv\Scripts\python -m uvicorn streamcraft.api.main:app --host $BackendHost --port $BackendPort
} else {
    Write-Host "Backend skipped. Serving static UI only..." -ForegroundColor Yellow
    
    # Simple static server for UI dist
    $uiPath = Join-Path $root "ui\react"
    Push-Location $uiPath
    npx http-server dist -p $UiPort -o
    Pop-Location
}
