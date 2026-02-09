param(
    [switch]$SkipBackend,
    [switch]$SkipUi
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Building Streamcraft TTS..." -ForegroundColor Cyan

# Backend setup
if (-not $SkipBackend) {
    Write-Host "`n[Backend] Installing Python dependencies..." -ForegroundColor Yellow
    
    if (-not (Test-Path ".venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor Cyan
        python -m venv .venv
    }
    
    & .venv\Scripts\pip install -U pip
    & .venv\Scripts\pip install -e backend
    
    Write-Host "[Backend] Dependencies installed!" -ForegroundColor Green
}

# UI setup
if (-not $SkipUi) {
    $uiPath = Join-Path $root "ui\react"
    if (Test-Path $uiPath) {
        Write-Host "`n[Frontend] Installing Node dependencies..." -ForegroundColor Yellow
        Push-Location $uiPath
        
        if (-not (Test-Path "node_modules")) {
            npm install
        }
        
        Write-Host "[Frontend] Building production bundle..." -ForegroundColor Cyan
        npm run build
        
        Pop-Location
        Write-Host "[UI] Build complete!" -ForegroundColor Green
    }
}

Write-Host "`n✓ Build complete!" -ForegroundColor Green
Write-Host "  Run with: .\run.ps1 (production) or .\run_dev.ps1 (development)" -ForegroundColor Cyan
