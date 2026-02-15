param(
    [Parameter(Mandatory = $true)]
    [string]$Text,

    [Parameter(Mandatory = $true)]
    [string]$SpeakerDataset,

    [int]$SpeakerClipCount = 3,

    [Parameter(Mandatory = $true)]
    [string]$OutputFile,

    [string]$Model = "xtts_v2",
    [string]$Language = "en"
)

$ErrorActionPreference = 'Stop'

function Resolve-Python {
    param([string]$RepoRoot)

    if ($env:STREAMCRAFT_TTS_PYTHON -and (Test-Path $env:STREAMCRAFT_TTS_PYTHON)) {
        return $env:STREAMCRAFT_TTS_PYTHON
    }

    $ttsVenvPython = Join-Path $RepoRoot ".venv-tts311\Scripts\python.exe"
    if (Test-Path $ttsVenvPython) {
        return $ttsVenvPython
    }

    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        $probe = & py -3.11 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $probe) {
            $ttsVenvPath = Join-Path $RepoRoot ".venv-tts311"
            if (-not (Test-Path $ttsVenvPath)) {
                Write-Host "[tts-script] Creating Python 3.11 venv for XTTS: $ttsVenvPath"
                & py -3.11 -m venv $ttsVenvPath
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to create Python 3.11 venv for XTTS"
                }
            }

            $createdPython = Join-Path $ttsVenvPath "Scripts\python.exe"
            if (Test-Path $createdPython) {
                return $createdPython
            }
        }
    }

    $rootVenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
    if (Test-Path $rootVenvPython) {
        return $rootVenvPython
    }

    $backendVenvPython = Join-Path $RepoRoot "backend\.venv\Scripts\python.exe"
    if (Test-Path $backendVenvPython) {
        return $backendVenvPython
    }

    $fallback = Get-Command python -ErrorAction SilentlyContinue
    if ($fallback) {
        return $fallback.Source
    }

    throw "Python executable not found. Configure backend venv or install Python."
}

function Ensure-TtsDependencies {
    param([string]$PythonExe)

    & $PythonExe -c "from TTS.api import TTS; import torch; from transformers import BeamSearchScorer; ver=torch.__version__.split('+')[0].split('.'); major=int(ver[0]); minor=int(ver[1]); assert not (major > 2 or (major == 2 and minor >= 6)); print('ok')" *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    Write-Host "[tts-script] Installing XTTS dependencies in: $PythonExe"
    & $PythonExe -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upgrade pip for XTTS environment"
    }

    & $PythonExe -m pip install "TTS==0.22.0" "transformers<5" "tokenizers<0.20" "torch<2.6" "torchaudio<2.6"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install Coqui TTS. Use Python 3.11 and run: python -m pip install TTS==0.22.0 'transformers<5' 'tokenizers<0.20' 'torch<2.6' 'torchaudio<2.6'"
    }
}

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Resolve-Path (Join-Path $scriptDir "..")

    $datasetPath = Resolve-Path $SpeakerDataset
    $clipsDir = Join-Path $datasetPath "clips"
    if (-not (Test-Path $clipsDir)) {
        throw "Clips directory not found: $clipsDir"
    }

    $wavClips = Get-ChildItem -Path $clipsDir -Filter *.wav -File | Sort-Object Name
    if (-not $wavClips -or $wavClips.Count -eq 0) {
        throw "No .wav speaker clips found in: $clipsDir"
    }

    $selectedClips = $wavClips | Select-Object -First ([Math]::Max(1, $SpeakerClipCount))

    $outputDir = Split-Path -Parent $OutputFile
    if ($outputDir -and -not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }

    $pythonExe = Resolve-Python -RepoRoot $repoRoot
    Ensure-TtsDependencies -PythonExe $pythonExe

    $env:SC_TEXT = $Text
    $env:SC_SPEAKER_DATASET = [string]$datasetPath
    if ([System.IO.Path]::IsPathRooted($OutputFile)) {
        $env:SC_OUTPUT_FILE = $OutputFile
    }
    else {
        $env:SC_OUTPUT_FILE = Join-Path (Get-Location).Path $OutputFile
    }
    $env:SC_MODEL = $Model
    $env:SC_LANGUAGE = $Language
    $env:SC_SPEAKER_CLIP_COUNT = [string]([Math]::Max(1, $SpeakerClipCount))

    Write-Host "[tts-script] Python: $pythonExe"
    Write-Host "[tts-script] Speaker dataset: $datasetPath"
    Write-Host "[tts-script] Using clips: $($selectedClips.Count)"
    Write-Host "[tts-script] Output: $OutputFile"

    $pythonCode = @'
import os
import sys
from pathlib import Path

text = os.environ.get("SC_TEXT", "").strip()
speaker_dataset = Path(os.environ.get("SC_SPEAKER_DATASET", "")).resolve()
output_file = Path(os.environ.get("SC_OUTPUT_FILE", "")).resolve()
model = (os.environ.get("SC_MODEL") or "xtts_v2").strip()
language = (os.environ.get("SC_LANGUAGE") or "en").strip()
clip_count = int(os.environ.get("SC_SPEAKER_CLIP_COUNT") or "3")

if not text:
    raise RuntimeError("Text is empty")

clips_dir = speaker_dataset / "clips"
if not clips_dir.exists():
    raise RuntimeError(f"Clips directory not found: {clips_dir}")

clips = sorted(clips_dir.glob("*.wav"))
if not clips:
    raise RuntimeError(f"No .wav clips found in {clips_dir}")

speaker_wavs = [str(path) for path in clips[:max(1, clip_count)]]

try:
    import torch
except Exception as exc:
    raise RuntimeError(
        "Missing 'torch' in XTTS runtime. Install in the selected TTS Python environment."
    ) from exc

try:
    from TTS.api import TTS
except Exception as exc:
    raise RuntimeError(
        "Missing Coqui TTS package in XTTS runtime. Install TTS==0.22.0 in the selected TTS Python environment."
    ) from exc

device = "cuda" if torch.cuda.is_available() else "cpu"
model_name = f"tts_models/multilingual/multi-dataset/{model}"

print(f"[tts-script] device={device}")
print(f"[tts-script] model={model_name}")
print(f"[tts-script] language={language}")
print(f"[tts-script] speaker_wavs={len(speaker_wavs)}")

tts = TTS(model_name=model_name, progress_bar=False)
tts = tts.to(device)

output_file.parent.mkdir(parents=True, exist_ok=True)
tts.tts_to_file(
    text=text,
    file_path=str(output_file),
    speaker_wav=speaker_wavs,
    language=language,
)

print(f"[tts-script] done: {output_file}")
'@

    & $pythonExe -c $pythonCode
    if ($LASTEXITCODE -ne 0) {
        throw "TTS python process failed with exit code $LASTEXITCODE"
    }

    if (-not (Test-Path $OutputFile)) {
        throw "TTS completed but output file was not created: $OutputFile"
    }

    Write-Host "[tts-script] Success"
    exit 0
}
catch {
    $message = $_.Exception.Message
    if (-not $message) {
        $message = ($_ | Out-String)
    }
    Write-Host "[tts-script] ERROR: $message"
    exit 1
}
