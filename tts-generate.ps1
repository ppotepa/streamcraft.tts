param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [string]$SpeakerAudio,  # Reference audio for voice cloning
    [string]$SpeakerDataset,  # Dataset folder with clips/manifest
    [int]$SpeakerClipCount = 1,
    [string]$OutputFile = "output/tts_output.wav",
    [string]$Model = "xtts_v2",  # or path to custom model
    [string]$Language = "en"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $SpeakerAudio -and -not $SpeakerDataset) {
    throw "Specify either -SpeakerAudio or -SpeakerDataset"
}

if ($SpeakerAudio -and $SpeakerDataset) {
    throw "Use only one of -SpeakerAudio or -SpeakerDataset"
}

Write-Host "=== TTS Voice Synthesis ===" -ForegroundColor Cyan

# Root and temp/cache
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $root 'temp'
$cacheDir = Join-Path $tempDir 'cache'

$env:TMP = $tempDir
$env:TEMP = $tempDir
$env:LOCALAPPDATA = $cacheDir
$env:HF_HOME = Join-Path $cacheDir 'hf'

function Select-DatasetClips {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DatasetPath,
        [int]$Count = 1
    )

    $dataset = Resolve-Path $DatasetPath -ErrorAction Stop
    $clipsDir = Join-Path $dataset 'clips'
    if (-not (Test-Path $clipsDir)) {
        throw "Dataset clips folder not found: $clipsDir"
    }

    if ($Count -lt 1) {
        throw "Count must be at least 1"
    }

    $selected = @()
    $seen = [System.Collections.Generic.HashSet[string]]::new()

    $manifest = Join-Path $dataset 'manifest.csv'
    if (Test-Path $manifest) {
        try {
            $rows = Import-Csv $manifest
            if ($rows) {
                $scored = $rows | ForEach-Object {
                    $start = [double]($_.start_sec)
                    $end = [double]($_.end_sec)
                    $_ | Add-Member -NotePropertyName duration -NotePropertyValue ($end - $start) -Force
                    $_
                }
                foreach ($row in ($scored | Sort-Object duration -Descending)) {
                    $candidate = Join-Path $clipsDir $row.clip
                    if (-not $candidate) { continue }
                    if ($seen.Contains($candidate)) { continue }
                    $hiFiCandidate = [System.IO.Path]::ChangeExtension($candidate, '.m4a')
                    $preferred = if ($hiFiCandidate -and (Test-Path $hiFiCandidate)) { $hiFiCandidate } elseif (Test-Path $candidate) { $candidate } else { $null }
                    if (-not $preferred) { continue }
                    if ($seen.Contains($preferred)) { continue }
                    if (Test-Path $preferred) {
                        $selected += $preferred
                        $seen.Add($candidate) | Out-Null
                        $seen.Add($preferred) | Out-Null
                        if ($selected.Count -ge $Count) { return $selected }
                    }
                }
            }
        } catch {
            Write-Warning "Failed to parse manifest: $_"
        }
    }

    $fallback = @(
        (Get-ChildItem $clipsDir -Filter *.m4a -File | Sort-Object Length -Descending),
        (Get-ChildItem $clipsDir -Filter *.wav -File | Sort-Object Length -Descending)
    ) | Where-Object { $_ }
    foreach ($clip in $fallback) {
        if ($seen.Contains($clip.FullName)) { continue }
        $selected += $clip.FullName
        if ($selected.Count -ge $Count) { break }
    }

    if (-not $selected) {
        throw "No clips found in dataset: $clipsDir"
    }

    return $selected
}

if ($SpeakerDataset -and $SpeakerClipCount -lt 1) {
    throw "-SpeakerClipCount must be >= 1"
}

$speakerClips = @()
if ($SpeakerDataset) {
    $speakerClips = Select-DatasetClips -DatasetPath $SpeakerDataset -Count $SpeakerClipCount
    Write-Host "[i] Selected $($speakerClips.Count) dataset clip(s)" -ForegroundColor Cyan
} elseif ($SpeakerAudio) {
    $speakerClips = @($SpeakerAudio)
}

if (-not $speakerClips -or $speakerClips.Count -eq 0) {
    throw "No speaker clips provided"
}

$speakerClips = $speakerClips | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

foreach ($clip in $speakerClips) {
    if (-not (Test-Path $clip)) {
        throw "Speaker reference audio not found: $clip"
    }
}

$OutputFile = [System.IO.Path]::GetFullPath($OutputFile)

# TTS venv
$venv = Join-Path $root '.venv-tts'
$python = Join-Path $venv 'Scripts\python.exe'
$depsMarker = Join-Path $venv '.deps_installed'
$depsVersion = '2026-02-06b'
$transformersSpec = 'transformers==4.39.3'

if (Test-Path $depsMarker) {
    $markerContent = Get-Content $depsMarker -ErrorAction SilentlyContinue
    if ($markerContent -ne $depsVersion) {
        Remove-Item -Path $depsMarker -Force -ErrorAction SilentlyContinue
    }
}

function New-TtsVenv {
    Write-Host '[i] Creating TTS venv (Python 3.11)...' -ForegroundColor Cyan
    $created = $false
    try {
        & py -3.11 -m venv $venv
        $created = $true
    } catch {
        Write-Warning "py -3.11 not available or failed; falling back to default python"
    }
    if (-not $created) {
        & python -m venv $venv
    }
    Remove-Item -Path $depsMarker -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $python)) {
    New-TtsVenv
}

$pyVersion = & $python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ([version]$pyVersion -ge [version]'3.12') {
    Write-Host "[i] Current TTS venv uses Python $pyVersion; rebuilding with 3.11..." -ForegroundColor Yellow
    Remove-Item -Path $venv -Recurse -Force -ErrorAction SilentlyContinue
    New-TtsVenv
    $pyVersion = & $python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ([version]$pyVersion -ge [version]'3.12') {
        throw "TTS requires Python < 3.12 but py -3.11 is unavailable. Install Python 3.11 and ensure 'py -3.11' works."
    }
}

if (-not (Test-Path $depsMarker)) {
    Write-Host '[i] Installing TTS dependencies (first run)...' -ForegroundColor Cyan
    & $python -m pip install -q -U pip
    & $python -m pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
    & $python -m pip install -q $transformersSpec
    & $python -m pip install -q TTS
    # Re-pin transformers in case TTS pulled a newer build
    & $python -m pip install -q --upgrade --no-deps $transformersSpec
    Set-Content -Path $depsMarker -Value $depsVersion -Encoding ascii
} else {
    Write-Host '[i] Reusing cached TTS environment' -ForegroundColor DarkGray
}

Write-Host "[i] Text: $Text" -ForegroundColor Cyan
Write-Host "[i] Reference clips: $($speakerClips.Count)" -ForegroundColor Cyan
Write-Host "[i] First clip: $($speakerClips[0])" -ForegroundColor Cyan
Write-Host "[i] Output: $OutputFile" -ForegroundColor Cyan
Write-Host "[i] Model: $Model" -ForegroundColor Cyan

# Ensure output directory exists
$outputDir = Split-Path $OutputFile -Parent
if ($outputDir) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

# Add CUDA DLLs
$cudaDllPath = Join-Path $venv "Lib\site-packages\nvidia\cublas\bin"
if (Test-Path $cudaDllPath) {
    $env:PATH = "$cudaDllPath;$env:PATH"
}

# Allow legacy torch.load behavior for xtts checkpoints
$env:TORCH_LOAD_BACKCOMPAT = '1'

Write-Host "[i] Generating speech..." -ForegroundColor Green

$env:TTS_TEXT = $Text
$env:TTS_SPEAKERS = ($speakerClips | ConvertTo-Json -Compress)
$env:TTS_OUTPUT = $OutputFile
$env:TTS_MODEL = $Model
$env:TTS_LANG = $Language

try {
    & $python -c @"
import json
import os
from TTS.api import TTS
import torch
from torch.serialization import add_safe_globals
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import XttsAudioConfig, XttsArgs

add_safe_globals([XttsConfig, XttsAudioConfig, XttsArgs])

_orig_torch_load = torch.load

def _compatible_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _orig_torch_load(*args, **kwargs)

torch.load = _compatible_torch_load

text = os.environ['TTS_TEXT']
speaker_entries = json.loads(os.environ['TTS_SPEAKERS'])
if isinstance(speaker_entries, str):
    speaker_entries = [speaker_entries]
output_file = os.environ['TTS_OUTPUT']
model_name = os.environ['TTS_MODEL']
language = os.environ['TTS_LANG']

print(f'[i] Loading model: {model_name}')

if model_name == 'xtts_v2':
    model_name = 'tts_models/multilingual/multi-dataset/xtts_v2'

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f'[i] Using device: {device}')

tts = TTS(model_name).to(device)

print('[i] Synthesizing...')
speaker_arg = speaker_entries if len(speaker_entries) > 1 else speaker_entries[0]
tts.tts_to_file(
    text=text,
    file_path=output_file,
    speaker_wav=speaker_arg,
    language=language
)

print(f'[OK] Generated: {output_file}')
"@
}
finally {
    Remove-Item Env:TTS_TEXT -ErrorAction SilentlyContinue
    Remove-Item Env:TTS_SPEAKERS -ErrorAction SilentlyContinue
    Remove-Item Env:TTS_OUTPUT -ErrorAction SilentlyContinue
    Remove-Item Env:TTS_MODEL -ErrorAction SilentlyContinue
    Remove-Item Env:TTS_LANG -ErrorAction SilentlyContinue
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[OK] Speech generated!" -ForegroundColor Green
    Write-Host "Output: $OutputFile" -ForegroundColor Cyan
} else {
    Write-Host "`n[!] Generation failed" -ForegroundColor Red
    exit $LASTEXITCODE
}
