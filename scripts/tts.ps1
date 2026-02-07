Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$datasetRoot = Join-Path $root 'dataset'
$ttsScript = Join-Path $root 'tts-generate.ps1'

if (-not (Test-Path $datasetRoot)) { throw "dataset folder not found: $datasetRoot" }
if (-not (Test-Path $ttsScript)) { throw "tts-generate.ps1 not found at $ttsScript" }

# Pick streamer
$streamers = @(Get-ChildItem $datasetRoot -Directory)
if ($streamers.Count -eq 0) { throw 'No datasets found under dataset/' }
Write-Host "Available streamers:" -ForegroundColor Yellow
for ($i = 0; $i -lt $streamers.Count; $i++) {
    Write-Host "  [$($i+1)] $($streamers[$i].Name)" -ForegroundColor White
}
$idx = [int](Read-Host "Select streamer (1-$($streamers.Count))") - 1
$streamer = $streamers[$idx]

# Collect clips (all VOD subfolders)
$clips = @(Get-ChildItem -Path $streamer.FullName -Recurse -Filter '*.wav')
if ($clips.Count -eq 0) { throw "No wav clips found under $($streamer.FullName)" }

# Choose a reference clip (first clip)
$refClip = $clips[0]

# Get text
$text = Read-Host "Enter text to synthesize"
if ([string]::IsNullOrWhiteSpace($text)) { throw 'Text is required' }

# Output
$outputDir = Join-Path $root 'output'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$outputFile = Join-Path $outputDir ("tts_" + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.wav')

# Model & language
$model = 'xtts_v2'
$language = 'en'

Write-Host "[i] Streamer: $($streamer.Name)" -ForegroundColor Cyan
Write-Host "[i] Reference clip: $($refClip.Name)" -ForegroundColor Cyan
Write-Host "[i] Output: $outputFile" -ForegroundColor Cyan

& $ttsScript -Text $text -SpeakerAudio $refClip.FullName -OutputFile $outputFile -Model $model -Language $language

Write-Host "[OK] Done: $outputFile" -ForegroundColor Green
