param(
    [string]$VodUrl,
    [switch]$Force,
    [switch]$MuxSubs,
    [switch]$UseDemucs,
    [switch]$KeepExistingClips,
    [switch]$NoClipAac,
    [double]$MaxDurationSeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $VodUrl) {
    $VodUrl = Read-Host 'Paste Twitch VOD URL'
    if (-not $VodUrl) {
        throw 'VOD URL is required.'
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $root 'temp'
$cacheDir = Join-Path $tempDir 'cache'
New-Item -ItemType Directory -Force -Path $tempDir, $cacheDir | Out-Null

$env:TMP = $tempDir
$env:TEMP = $tempDir
$env:TMPDIR = $tempDir
$env:LOCALAPPDATA = $cacheDir
$env:XDG_CACHE_HOME = $cacheDir
$env:HF_HOME = Join-Path $cacheDir 'hf'
$env:HUGGINGFACE_HUB_CACHE = Join-Path $cacheDir 'hf'
$env:CT2_HOME = Join-Path $cacheDir 'ct2'

$venv = Join-Path $root '.venv'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Host '[i] Creating virtual environment...' -ForegroundColor Cyan
    & python -m venv $venv
}

Write-Host '[i] Ensuring Python requirements...' -ForegroundColor Cyan
& $python -m pip install -U pip | Out-Null
& $python -m pip install -r (Join-Path $root 'requirements.txt') | Out-Null

$env:PYTHONPATH = $root

$pipelineArgs = @(
    '-m', 'src.pipeline',
    '--vod', $VodUrl,
    '--outdir', 'out',
    '--dataset-out', 'dataset',
    '--model', 'large-v3',
    '--language', 'en',
    '--threads', '8',
    '--compute-type', 'float16',
    '--progress-interval', '10',
    '--ds-threads', '4'
)

if ($Force) { $pipelineArgs += '--force' }
if ($MuxSubs) { $pipelineArgs += '--mux-subs' }
if ($UseDemucs) { $pipelineArgs += '--use-demucs' }
if ($KeepExistingClips) { $pipelineArgs += '--keep-existing-clips' }
if ($NoClipAac) { $pipelineArgs += '--no-clip-aac' }
if ($MaxDurationSeconds -gt 0) {
    $durationArg = $MaxDurationSeconds.ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $pipelineArgs += @('--max-duration', $durationArg)
}

Write-Host "[i] Running CUDA pipeline for $VodUrl" -ForegroundColor Green
& $python @pipelineArgs
