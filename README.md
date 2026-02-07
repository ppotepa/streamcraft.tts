# Streamcraft TTS

Twitch VOD → Transcription → Dataset → Voice Cloning pipeline with a wizard UI.

## Quick Start

### 1. Build
```powershell
.\build.ps1
```
Installs backend Python package + builds UI production bundle.

### 2. Run Development
```powershell
.\run_dev.ps1
```
Starts backend API (http://localhost:8010) + Vite dev server (http://localhost:5174) inline in the current terminal.

**Options:**
- `-NewWindow` - Launch backend/UI in separate terminal windows
- `-SkipBackend` - Run UI only (use existing backend or mock mode)
- `-SkipBuild` - Skip initial UI build check
- `-BackendPort 8010` / `-UiPort 5174` - Custom ports

### 3. Run Production
```powershell
.\run.ps1
```
Serves the built UI via the backend API server.

## Project Structure

```
streamcraft.tts/
├── backend/
│   └── streamcraft/         # Python package
│       ├── api/             # FastAPI routes
│       │   ├── main.py      # App & CORS config
│       │   └── routes.py    # Endpoint handlers
│       ├── cli/             # Typer CLI entrypoints
│       │   └── main.py      # streamcraft CLI
│       ├── core/            # Core pipeline services
│       │   ├── dataset.py   # Audio slicing & dataset generation
│       │   ├── pipeline.py  # Orchestration
│       │   └── transcribe.py # faster-whisper transcription
│       ├── jobs/            # Job state & logging (TODO)
│       ├── models/          # Pydantic schemas
│       │   └── api.py       # Request/response models
│       ├── paths.py         # Centralized path resolver
│       └── settings.py      # Configuration (pydantic-settings)
│
├── ui/react/                # Vite + React + Tailwind wizard
│   ├── src/
│   │   ├── api/client.ts    # Backend API client
│   │   └── App.tsx          # Main wizard component
│   └── dist/                # Production build output
│
├── scripts/                 # Legacy PowerShell helpers
│   ├── run_tts.ps1          # TTS interactive menu
│   ├── tts-generate.ps1     # Quick voice clone
│   ├── run_pipeline.ps1     # Legacy pipeline wrapper
│   └── README.md            # Migration notes
│
├── dataset/                 # Generated training clips (per streamer)
├── out/                     # VOD artifacts (audio, SRT, metadata)
├── jobs/                    # Job logs and state
│
├── build.ps1                # Install deps + build UI
├── run.ps1                  # Production run
└── run_dev.ps1              # Development run (inline mode default)
```

## Python CLI

The backend package exposes a `streamcraft` CLI (via Typer):

```powershell
# After build.ps1, activate venv:
.\.venv\Scripts\Activate.ps1

# Run full pipeline
streamcraft pipeline --vod "https://www.twitch.tv/videos/123456"

# See all options
streamcraft pipeline --help
```

**Key flags:**
- `--vod` - Twitch URL or local media file (required)
- `--outdir` / `--dataset-out` - Output directories (auto-grouped per streamer)
- `--model` - faster-whisper model (default: large-v3)
- `--language` - ISO code or 'auto' (default: en)
- `--compute-type` - Quantization (default: float16, requires CUDA)
- `--threads` - CPU threads for transcription (default: 8)
- `--force` - Re-download + re-slice existing data
- `--use-demucs` - Isolate vocals with Demucs
- `--min-speech-ms` / `--max-clip-sec` / `--pad-ms` - Dataset slicing parameters
- `--mux-subs` - Mux SRT back into MP4 for preview
- `--vod-quality` - twitchdl quality preset (default: audio_only)

Supplying a Twitch URL automatically routes artifacts to `out/<streamer>/vods/<vodId>` and `dataset/<streamer>` based on video owner metadata (no manual streamer name needed).

## FastAPI Backend

Backend runs on port **8010** by default:

- `GET /health` - Health check
- `GET /api/vod/check?vod_url=...` - Fetch VOD metadata
- `POST /api/audio/run` - Extract audio from VOD
- `POST /api/sanitize/run` - Sanitize audio (remove silence)
- `POST /api/srt/run` - Transcribe to SRT
- `POST /api/tts/run` - Generate TTS output

> ⚠️ **Current Status:** Stub implementations return mock data. Next phase: wire these routes to `core/` services with background job execution + logging.

## UI Development

The wizard UI (React + Tailwind) is in [ui/react](ui/react):

```powershell
cd ui\react

# Dev server only (no backend)
npm run dev -- --host --port 5174

# Build for production
npm run build
```

**Environment variables** (create `.env`):
```env
VITE_API_BASE=http://localhost:8010/api
VITE_USE_MOCK=false
```

## Data Layout

- **VOD artifacts:** `out/<streamer>/vods/<vodId>/`
  - `<vodId>_full.wav` (48 kHz stereo master)
  - `<vodId>.srt`, `.vtt`, `.txt`, `.meta.json`
- **Dataset clips:** `dataset/<streamer>/clips/`  
  - `<clipId>.wav` (48 kHz PCM master)
  - `<clipId>.m4a` (optional high-bitrate AAC, disable with `--no-clip-aac`)
  - `manifest.csv`, `segments.json`
- **Job logs:** `jobs/logs/<jobId>.log` (future)

## TTS & Voice Cloning

Legacy TTS scripts are in [scripts/](scripts):

### Interactive Menu
```powershell
.\scripts\run_tts.ps1
```
Features:
- Generate speech with voice cloning (instant, no training!)
- Fine-tune XTTS on your dataset
- Train custom TTS models
- List available models and datasets
- Test voice quality

### Quick Voice Clone (No Training)
```powershell
# Use a single reference clip
.\scripts\tts-generate.ps1 -Text "Your text" -SpeakerAudio "dataset\streamer\clips\000001.m4a" -OutputFile "output\clone.wav"

# Or use averaged embeddings from multiple clips
.\scripts\tts-generate.ps1 -Text "Your text" -SpeakerDataset "dataset\streamer" -SpeakerClipCount 100 -OutputFile "output\clone.wav"
```

### Fine-tune for Better Quality
```powershell
.\scripts\finetune-xtts.ps1 -DatasetDir "dataset\streamer" -Steps 1000
```

### Train Custom Model
```powershell
.\scripts\train-tts.ps1 -DatasetDir "dataset\streamer" -Model "xtts" -Epochs 100
```

See [TTS_TRAINING.md](TTS_TRAINING.md) for detailed guide.

## Pipeline Workflow

1. **VOD Check** → Fetch Twitch metadata or validate local media
2. **Audio Extraction** → Download & convert to 48 kHz stereo master WAV
3. **Audio Sanitization** → (Optional) Remove silence, isolate vocals with Demucs
4. **Transcription** → faster-whisper CUDA transcription → SRT/VTT/TXT
5. **Dataset Slicing** → Parse SRT, slice clips with padding/merging → training dataset

Each step creates artifacts in `out/<streamer>/vods/<vodId>/` and accumulates clips in `dataset/<streamer>/clips/`.

## Requirements

- **Python 3.10+** with CUDA support (faster-whisper requires GPU)
- **Node.js 18+** for UI build
- **ffmpeg** on PATH for audio processing
- **CUDA toolkit** (cuDNN, cuBLAS) for GPU transcription

> If transcription fails with `cublas64_12.dll` missing:
> ```powershell
> .\.venv\Scripts\pip install --upgrade "ctranslate2>=4.2.0" --extra-index-url https://download.pytorch.org/whl/cu124
> .\.venv\Scripts\pip install nvidia-cublas-cu12==12.4.5.8 nvidia-cuda-runtime-cu12==12.4.127 nvidia-cudnn-cu12==9.1.0.70
> ```

## Configuration

Backend settings via environment variables (`STREAMCRAFT_*` prefix):

```env
STREAMCRAFT_BASE_DIR=d:/git/streamcraft.tts
STREAMCRAFT_API_HOST=localhost
STREAMCRAFT_API_PORT=8010
STREAMCRAFT_WHISPER_MODEL=large-v3
STREAMCRAFT_WHISPER_LANGUAGE=en
STREAMCRAFT_WHISPER_COMPUTE_TYPE=float16
```

Or use [backend/streamcraft/settings.py](backend/streamcraft/settings.py) defaults.

## Notes

- Default ports: backend **8010**, UI dev **5174** (to avoid conflicts with common dev ports 8000/5173)
- `run_dev.ps1` runs **inline by default** (backend as background job, UI in foreground); add `-NewWindow` for separate terminals
- Legacy scripts in `/scripts` may reference old `src/` paths; use `streamcraft` CLI where possible
- Clip numbering auto-continues across VODs (e.g., if clips 1-500 exist, next VOD starts at 501)
- AAC mirrors (`.m4a`) are generated by default; disable with `--no-clip-aac`

## Next Steps

1. ✅ Backend package structure created
2. ✅ FastAPI skeleton with stub routes
3. ✅ Typer CLI entrypoint
4. ✅ UI wizard updated to call new endpoints
5. ⏳ Wire API routes to core services (in progress)
6. ⏳ Implement job queue + background execution
7. ⏳ Add job polling to UI wizard
8. ⏳ Add tests for core services
9. ⏳ Integrate TTS generation into backend API

---

**Questions?** Check [scripts/README.md](scripts/README.md) for legacy script migration notes or open an issue.
