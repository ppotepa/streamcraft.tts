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

# Silence Coqui license prompt (you must already have agreed to CPML/commercial terms)
$env:COQUI_TOS_AGREEMENT = '1'
$env:COQUI_LICENSE_CONFIRM = '1'

function Select-DatasetClips {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DatasetPath,
        [int]$Count = 1
    )

    $dataset = Resolve-Path $DatasetPath -ErrorAction Stop
    $clipsDir = Join-Path $dataset 'clips'
    $voiceSamplesDir = Join-Path $dataset 'voice_samples'

    if (-not (Test-Path $clipsDir) -and -not (Test-Path $voiceSamplesDir)) {
        throw "Dataset clips folder not found: $clipsDir"
    }

    if ($Count -lt 1) {
        throw "Count must be at least 1"
    }

    $selected = @()
    $seen = [System.Collections.Generic.HashSet[string]]::new()

    # Prefer curated voice samples when present
    if (Test-Path $voiceSamplesDir) {
        $voiceCandidates = Get-ChildItem $voiceSamplesDir -Filter *.wav -File | Sort-Object Length -Descending
        foreach ($clip in $voiceCandidates) {
            if ($seen.Contains($clip.FullName)) { continue }
            $selected += $clip.FullName
            if ($selected.Count -ge $Count) { return $selected }
        }
    }

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

    $fallbackDirs = @()
    if (Test-Path $clipsDir) { $fallbackDirs += $clipsDir }
    if (Test-Path $voiceSamplesDir) { $fallbackDirs += $voiceSamplesDir }
    foreach ($dir in $fallbackDirs) {
        $fallback = @(
            (Get-ChildItem $dir -Filter *.m4a -File | Sort-Object Length -Descending),
            (Get-ChildItem $dir -Filter *.wav -File | Sort-Object Length -Descending)
        ) | Where-Object { $_ }
        foreach ($clip in $fallback) {
            if ($seen.Contains($clip.FullName)) { continue }
            $selected += $clip.FullName
            if ($selected.Count -ge $Count) { break }
        }
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

# Convert non-wav speaker clips to wav so torchaudio/soundfile can load them reliably
$speakerWavDir = Join-Path $tempDir 'tts_speaker_wav'
New-Item -ItemType Directory -Force -Path $speakerWavDir | Out-Null

function Get-Ffmpeg {
    $ffmpegExe = $env:FFMPEG_PATH
    if (-not $ffmpegExe) {
        $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
        if ($cmd) { $ffmpegExe = $cmd.Source }
    }
    if (-not $ffmpegExe) {
        throw "ffmpeg not found. Install ffmpeg and ensure it is on PATH or set FFMPEG_PATH to ffmpeg.exe"
    }
    return $ffmpegExe
}

function Convert-ToWav {
    param([Parameter(Mandatory = $true)][string]$ClipPath)

    $ext = ([IO.Path]::GetExtension($ClipPath) ?? '').ToLowerInvariant()
    if ($ext -eq '.wav') { return $ClipPath }

    $base = [IO.Path]::GetFileNameWithoutExtension($ClipPath)
    $target = Join-Path $speakerWavDir "$base.wav"

    if (-not (Test-Path $target)) {
        Write-Host "[i] Converting reference clip to wav: $ClipPath" -ForegroundColor DarkGray
        $ffmpegExe = Get-Ffmpeg

        $fileInfo = Get-Item -LiteralPath $ClipPath -ErrorAction Stop
        if ($fileInfo.Length -le 0) {
            throw "Clip has zero length: $ClipPath"
        }

        $args = @('-y', '-i', $ClipPath, '-vn', '-sn', '-ar', '24000', '-ac', '1', '-acodec', 'pcm_s16le', $target)
        $ffmpegOutput = & $ffmpegExe @args 2>&1
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) {
            $msg = "Failed to convert $ClipPath to wav; ffmpeg exit code $LASTEXITCODE. Output: $ffmpegOutput"
            throw $msg
        }
    }

    return $target
}

$convertedClips = @()
foreach ($clip in $speakerClips) {
    try {
        $converted = Convert-ToWav $clip
        if ($converted) { $convertedClips += $converted }
    } catch {
        Write-Warning "Skipping clip $($clip): $($_)"
    }
}

$speakerClips = $convertedClips
if (-not $speakerClips -or $speakerClips.Count -eq 0) {
    # Fallback: use the dataset clean WAV (first 6s) if available
    $fallback = Get-ChildItem -LiteralPath $SpeakerDataset -Filter '*_clean.wav' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $fallback) {
        $fallback = Get-ChildItem -LiteralPath $SpeakerDataset -Filter '*.wav' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if (-not $fallback) {
        throw "All speaker clips failed to convert and no fallback clean WAV found in dataset."
    }

    $ffmpegExe = Get-Ffmpeg
    $fallbackOut = Join-Path $speakerWavDir 'fallback.wav'
    Write-Host "[i] Using fallback clip (first 6s): $($fallback.FullName)" -ForegroundColor Yellow
    $args = @('-y', '-i', $fallback.FullName, '-t', '6', '-vn', '-sn', '-ar', '24000', '-ac', '1', '-acodec', 'pcm_s16le', $fallbackOut)
    $ffmpegOutput = & $ffmpegExe @args 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $fallbackOut)) {
        throw "Failed to create fallback clip; ffmpeg exit code $LASTEXITCODE. Output: $ffmpegOutput"
    }
    $speakerClips = @($fallbackOut)
}

$OutputFile = [System.IO.Path]::GetFullPath($OutputFile)

# TTS venv
$venv = Join-Path $root '.venv-tts'
$python = Join-Path $venv 'Scripts\python.exe'
$depsMarker = Join-Path $venv '.deps_installed'
$depsVersion = '2026-02-08a'
$transformersSpec = 'transformers==4.39.3'

if (Test-Path $depsMarker) {
    $markerContent = Get-Content $depsMarker -ErrorAction SilentlyContinue
    if ($markerContent -ne $depsVersion) {
        Remove-Item -Path $depsMarker -Force -ErrorAction SilentlyContinue
    }
}

function New-TtsVenv {
    Write-Host '[i] Creating TTS venv (preferring Python 3.11/3.10)...' -ForegroundColor Cyan

    $candidates = @(
        @{ Cmd = 'py'; Args = @('-3.11') },
        @{ Cmd = 'py'; Args = @('-3.10') },
        @{ Cmd = 'python'; Args = @() }
    )

    $created = $false

    foreach ($candidate in $candidates) {
        $args = @()
        if ($candidate.Args) { $args += $candidate.Args }
        $args += @('-m', 'venv', $venv)

        try {
            & $candidate.Cmd @args
            if ($LASTEXITCODE -eq 0 -and (Test-Path $python)) {
                $created = $true
                break
            }
        } catch {
            continue
        }
    }

    if (-not $created) {
        throw "Failed to create TTS virtual environment. Install Python 3.11 or 3.10 and ensure 'py -3.11' or 'py -3.10' works."
    }

    Remove-Item -Path $depsMarker -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $python)) {
    New-TtsVenv
}

$pyVersion = & $python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ([version]$pyVersion -ge [version]'3.12') {
    Write-Host "[i] Current TTS venv uses Python $pyVersion; rebuilding with Python 3.11/3.10..." -ForegroundColor Yellow
    Remove-Item -Path $venv -Recurse -Force -ErrorAction SilentlyContinue
    New-TtsVenv
    $pyVersion = & $python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    if ([version]$pyVersion -ge [version]'3.12') {
        throw "TTS requires Python < 3.12. Install Python 3.11 or 3.10 and ensure 'py -3.11' or 'py -3.10' is available."
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

# Belt-and-suspenders: force Coqui license prompts to auto-accept non-interactively
$env:COQUI_TOS_AGREEMENT = '1'
$env:COQUI_LICENSE_CONFIRM = '1'
$env:COQUI_CLI_TELEMETRY = '0'

try {
    & $python -c @"
import json
import os
from TTS.api import TTS
import torch
from torch.serialization import add_safe_globals
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import XttsAudioConfig, XttsArgs
import builtins

# Auto-accept Coqui CPML prompt in non-interactive runs
def _auto_input(prompt: str = ""):
    print(prompt, flush=True)
    return "y"

builtins.input = _auto_input

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
