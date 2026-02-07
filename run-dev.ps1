param(
    [string]$BackendCmd = ".venv\\Scripts\\python.exe -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000",
    [string]$UiCmd = "npm run dev -- --host --port 5173",
    [switch]$SkipBackend
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not $SkipBackend) {
    $apiPath = Join-Path $root 'api\main.py'
    if (Test-Path $apiPath) {
        Write-Host "Starting backend: $BackendCmd" -ForegroundColor Cyan
        Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd `"$root`"; $BackendCmd" | Out-Null
    }
    else {
        Write-Warning "api/main.py not found. Backend not started. Pass -BackendCmd <cmd> to override or create api/main.py."
    }
} else {
    Write-Host "Skipping backend (per flag)" -ForegroundColor Yellow
}

$uiPath = Join-Path $root 'ui/react'
if (-not (Test-Path $uiPath)) {
    Write-Error "UI path not found: $uiPath"; exit 1
}

Write-Host "Starting UI: $UiCmd" -ForegroundColor Cyan
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd `"$uiPath`"; $UiCmd" | Out-Null

Write-Host "Launched backend and UI in separate terminals." -ForegroundColor Green
