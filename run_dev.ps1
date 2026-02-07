param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8010,
    [string]$BackendCmd,
    [string]$UiDir = "ui/react",
    [int]$UiPort = 5174,
    [string]$UiDevCmd,
    [switch]$SkipBackend,
    [switch]$SkipBuild,
    [switch]$NewWindow
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Starting Streamcraft TTS (dev mode)..." -ForegroundColor Cyan

$uiPath = Join-Path $root $UiDir
if (-not (Test-Path $uiPath)) { Write-Error "UI path not found: $uiPath"; exit 1 }

# Install UI deps if needed
if (-not (Test-Path (Join-Path $uiPath 'node_modules'))) {
    Write-Host "`n[UI] Installing dependencies (first run)..." -ForegroundColor Cyan
    Push-Location $uiPath
    npm install
    Pop-Location
}

# Build UI if requested
if (-not $SkipBuild) {
    Write-Host "`n[UI] Building..." -ForegroundColor Cyan
    Push-Location $uiPath
    npm run build
    Pop-Location
}

$resolvedBackendCmd = if ($BackendCmd) { $BackendCmd } else { ".venv\\Scripts\\python.exe -m uvicorn streamcraft.api.main:app --reload --host $BackendHost --port $BackendPort" }
$resolvedUiDevCmd = if ($UiDevCmd) { $UiDevCmd } else { "npm run dev -- --host --port $UiPort" }

if (-not $SkipBackend) {
    Write-Host "`n[Backend] Starting API server on ${BackendHost}:${BackendPort}..." -ForegroundColor Yellow
    Write-Host "Command: $resolvedBackendCmd" -ForegroundColor DarkGray
    
    if ($NewWindow) {
        Start-Process pwsh -ArgumentList '-NoExit','-Command',"cd `"$root`"; $resolvedBackendCmd" | Out-Null
        Write-Host "[Backend] Started in new window." -ForegroundColor Green
    } else {
        $backendJob = Start-Job -ScriptBlock {
            param($cmd, $cwd)
            Set-Location $cwd
            Invoke-Expression $cmd
        } -ArgumentList $resolvedBackendCmd, $root
        Write-Host "[Backend] Running as background job (ID: $($backendJob.Id))." -ForegroundColor Green
        Write-Host "          Stop with: Get-Job | Stop-Job" -ForegroundColor DarkGray
    }
    
    Start-Sleep -Seconds 2
} else {
    Write-Host "`n[Backend] Skipped (per flag)." -ForegroundColor Yellow
}

Write-Host "`n[UI] Starting Vite dev server on port ${UiPort}..." -ForegroundColor Yellow
Write-Host "Command: $resolvedUiDevCmd" -ForegroundColor DarkGray

Push-Location $uiPath

if ($NewWindow) {
    Start-Process pwsh -ArgumentList '-NoExit','-Command',"cd `"$uiPath`"; $resolvedUiDevCmd" | Out-Null
    Write-Host "[UI] Started in new window." -ForegroundColor Green
    Write-Host "`n✓ Dev servers launched!" -ForegroundColor Green
    Write-Host "  Backend: http://${BackendHost}:${BackendPort}" -ForegroundColor Cyan
    Write-Host "  UI:      http://localhost:${UiPort}" -ForegroundColor Cyan
    Pop-Location
} else {
    Write-Host "[UI] Running inline (Ctrl+C to stop)..." -ForegroundColor Green
    Invoke-Expression $resolvedUiDevCmd
    Pop-Location
}
