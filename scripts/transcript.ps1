param(
    [Parameter(Mandatory = $true)][string]$VodUrl,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $root 'run_pipeline.ps1'

if (-not (Test-Path $script)) {
    throw "run_pipeline.ps1 not found at $script"
}

$cmd = @($script, '-VodUrl', $VodUrl)
if ($Force) { $cmd += '-Force' }

Write-Host "[i] Running transcription + slicing (CUDA) for $VodUrl" -ForegroundColor Cyan
& pwsh -NoProfile -File @cmd
