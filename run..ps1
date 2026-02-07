param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8010,
    [string]$BackendCmd,
    [string]$UiDir = "ui/react",
    [int]$UiPort = 5174,
    [string]$UiDevCmd,
    [string]$UiBuildCmd = "npm run build",
    [switch]$SkipBackend,
    [switch]$SkipBuild,
    [switch]$Inline
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$resolvedBackendCmd = if ($BackendCmd) { $BackendCmd } else { ".venv\\Scripts\\python.exe -m uvicorn api.main:app --reload --host $BackendHost --port $BackendPort" }
$resolvedUiDevCmd = if ($UiDevCmd) { $UiDevCmd } else { "npm run dev -- --host --port $UiPort" }

$uiPath = Join-Path $root $UiDir
if (-not (Test-Path $uiPath)) { Write-Error "UI path not found: $uiPath"; exit 1 }

if (-not (Test-Path (Join-Path $uiPath 'node_modules'))) {
    Write-Host "Installing UI dependencies (first run)..." -ForegroundColor Cyan
    Push-Location $uiPath
    npm install
    Pop-Location
}

if (-not $SkipBuild) {
    Write-Host "Building UI..." -ForegroundColor Cyan
    Push-Location $uiPath
    npm run build
    Pop-Location
}

if (-not $SkipBackend) {
    $apiPath = Join-Path $root 'api/main.py'
    if (Test-Path $apiPath) {
        Write-Host "Starting backend: $resolvedBackendCmd" -ForegroundColor Cyan
        if ($Inline) {
            # Run backend as background job to keep output in this terminal.
            $backendJob = Start-Job -ScriptBlock {
                param($cmd, $cwd)
                Set-Location $cwd
                Invoke-Expression $cmd
            } -ArgumentList $resolvedBackendCmd, $root
            Write-Host "Backend job started (Job Id: $($backendJob.Id))." -ForegroundColor Yellow
        } else {
            Start-Process pwsh -ArgumentList '-NoExit','-Command',"cd `"$root`"; $resolvedBackendCmd" | Out-Null
        }
    } else {
        Write-Warning "api/main.py not found. Backend not started. Pass -BackendCmd <cmd> to override or create api/main.py."
    }
} else {
    Write-Host "Skipping backend (per flag)" -ForegroundColor Yellow
}

Write-Host "Starting UI dev server: $resolvedUiDevCmd" -ForegroundColor Cyan
if ($Inline) {
    Push-Location $uiPath
    Invoke-Expression $resolvedUiDevCmd
    Pop-Location
} else {
    Start-Process pwsh -ArgumentList '-NoExit','-Command',"cd `"$uiPath`"; $resolvedUiDevCmd" | Out-Null
    Write-Host "run_dev launched backend and UI in separate terminals." -ForegroundColor Green
}
