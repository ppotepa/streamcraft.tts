# Streamcraft TTS

Twitch VOD to training-quality dataset to voice cloning, delivered as a Python backend plus a web wizard. This README is a full description of the application, architecture, workflows, setup, and operations.

## Table of Contents
- What this project is
- Core capabilities at a glance
- Architecture overview
- End-to-end workflow
- Wizard UI walkthrough
- Backend services and modules
- Data layout and artifacts
- Installation and setup
- Running (dev and production)
- Configuration and environment
- API endpoints
- CLI usage
- UI stack and development
- Jobs, logging, and observability
- Error handling and recovery
- TTS and Voice Lab
- Quality and dataset guidance
- Security and privacy notes
- Performance guidance
- Testing and QA approach
- Roadmap and future work
- FAQ
- Glossary

## What This Project Is
Streamcraft TTS is a single-user, desktop-friendly tool that ingests Twitch VODs (or local media), extracts audio, sanitizes it, transcribes with Whisper, slices training clips, and helps you review and export a dataset suitable for TTS fine-tuning. It also exposes quick voice cloning and XTTS fine-tune entry points through legacy scripts and future Voice Lab UI. The goal is predictable, low-friction runs with transparent state and artifacts you can inspect.

## Core Capabilities at a Glance
- VOD metadata check and validation with automatic streamer context.
- Audio extraction to 48 kHz stereo WAV with optional Demucs isolation.
- Sanitization: silence trimming, padding, clip duration controls, merge gap tuning.
- Transcription: faster-whisper (CUDA preferred) with model selection and language auto-detect.
- Dataset slicing from SRT with manifest generation (CSV/JSON) and clip numbering continuity across VODs.
- Review overlay to accept/reject clips and prepare exports.
- Export dataset manifests, clips, and transcripts; path copy previews for reproducibility.
- Voice cloning and XTTS training entry points via PowerShell scripts, with future UI integration.

## Architecture Overview
- **Backend:** FastAPI app plus Typer CLI in [backend/streamcraft](backend/streamcraft). Core services live in [backend/streamcraft/core](backend/streamcraft/core). Settings are centralized in [backend/streamcraft/settings.py](backend/streamcraft/settings.py). API routes are defined in [backend/streamcraft/api](backend/streamcraft/api).
- **UI:** React + Vite + Tailwind (with Pico baseline) in [ui/react](ui/react). The wizard is implemented in [ui/react/src/App.tsx](ui/react/src/App.tsx). API client lives in [ui/react/src/api/client.ts](ui/react/src/api/client.ts).
- **Scripts:** PowerShell helpers in [scripts](scripts) for legacy flows: quick TTS generation, XTTS fine-tune, and pipeline runners.
- **Data:** Outputs under `out/` (VOD artifacts) and `dataset/` (clips, manifests). Jobs/logs live under `jobs/` (planned).

## End-to-End Workflow
1) **VOD check**: Validate Twitch URL or local file; fetch metadata.
2) **Audio extraction**: Download or read media; convert to 48 kHz stereo WAV; optional Demucs isolation.
3) **Sanitize** (optional): Trim silence, enforce clip length, pad edges, merge near segments.
4) **Transcribe**: Run faster-whisper with chosen model and compute type; emit SRT/VTT/TXT and metadata.
5) **Dataset slicing**: Convert transcripts to time-aligned clips with padding and merge rules; generate manifests.
6) **Review**: Mark clips good/bad; bulk actions; accept/reject flow before export.
7) **Export/Continue**: Save manifests, copy paths, or jump into Voice Lab for cloning or training.

## Wizard UI Walkthrough
The UI is desktop-first with a left sidebar and main content area (max width 1200px). Detailed interaction rules are defined in [docs/uispec.md](docs/uispec.md).

- **Sidebar**: Project context (streamer), recent jobs with status badges, quick actions (Run pipeline, Open datasets, Voice Lab).
- **Main flow** (happy path):
  1. VOD Check: URL/file input, metadata preview, continue.
  2. Extraction: toggles for Demucs, language/compute defaults, size/time estimates.
  3. Sanitize drawer: silence threshold, min speech ms, pad ms, max clip sec, merge gap.
  4. Transcribe: model choice, threads, profanity filter; progress with percent.
  5. Review overlay: table of clips (id, start/end, duration, transcript, status), bulk accept/reject.
  6. Export: dataset summary (clip count, duration), export menu, Voice Lab entry.
- **States**: Skeletons for loading, inline errors per section, toast for success/failure, aria-live updates for progress. Drawers and overlays close with Esc; focus is managed for accessibility.

## Backend Services and Modules
- **FastAPI app** in [backend/streamcraft/api/main.py](backend/streamcraft/api/main.py): creates app, CORS, includes routes.
- **Routes** in [backend/streamcraft/api/routes.py](backend/streamcraft/api/routes.py): stub endpoints for health, VOD check, audio, sanitize, SRT, TTS.
- **Pipeline orchestration** in [backend/streamcraft/core/pipeline.py](backend/streamcraft/core/pipeline.py): will coordinate sequential steps, persist paths, and manage state transitions.
- **Transcription** in [backend/streamcraft/core/transcribe.py](backend/streamcraft/core/transcribe.py): faster-whisper integration (CUDA preferred, CPU fallback).
- **Dataset slicing** in [backend/streamcraft/core/dataset.py](backend/streamcraft/core/dataset.py): clip generation, padding, merge rules, manifest creation.
- **Settings** in [backend/streamcraft/settings.py](backend/streamcraft/settings.py): pydantic-settings with env overrides.
- **Models** in [backend/streamcraft/models/api.py](backend/streamcraft/models/api.py): request/response schemas for API.
- **CLI** in [backend/streamcraft/cli/main.py](backend/streamcraft/cli/main.py): exposes `streamcraft` Typer commands.

## Data Layout and Artifacts
- **VOD artifacts:** `out/<streamer>/vods/<vodId>/`
  - `<vodId>_full.wav` (48 kHz stereo master)
  - `<vodId>.srt`, `.vtt`, `.txt`, `.meta.json`
  - Optional muxed MP4 with subs when `--mux-subs` is used
- **Dataset clips:** `dataset/<streamer>/clips/`
  - `<clipId>.wav` (PCM master)
  - `<clipId>.m4a` (AAC mirror, disable with `--no-clip-aac`)
  - `manifest.csv`, `segments.json`
- **Jobs/logs:** `jobs/logs/<jobId>.log` and `jobs/state/<jobId>.json` (planned)
- **Cache:** faster-whisper models and Demucs artifacts may live under `temp/` or user cache.

Clip numbering continues across VODs for the same streamer to keep datasets monotonic.

## Installation and Setup
### Prerequisites
- Windows 10/11 (PowerShell 7 recommended)
- Python 3.10+ (CUDA build recommended for Whisper)
- Node.js 18+
- ffmpeg on PATH
- NVIDIA GPU with recent CUDA toolkit for best performance (CUDA 12.4 supported)

### One-time setup
```powershell
# From repository root
./build.ps1
```
This installs Python dependencies into `.venv`, installs the backend package in editable mode, and builds the UI production bundle.

If you prefer manual steps:
```powershell
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
cd ui/react
npm install
npm run build
cd ../..
pip install -e ./backend
```

## Running (Dev and Production)
### Development (backend + UI together)
```powershell
./run_dev.ps1
```
- Starts FastAPI backend on http://localhost:8010
- Starts Vite dev server on http://localhost:5174
- Runs inline in one terminal; add `-NewWindow` to split; add `-SkipBackend` to run UI only; add `-SkipBuild` to skip UI build check.

### Production-like
```powershell
./run.ps1
```
- Serves built UI via the backend server on http://localhost:8010

### UI only
```powershell
cd ui/react
npm run dev -- --host --port 5174
```
Set `VITE_USE_MOCK=true` in `.env` to run against mock data.

## Configuration and Environment
Backend settings are read from environment variables (prefix `STREAMCRAFT_`) or `.env` files. Common values:
```env
STREAMCRAFT_BASE_DIR=d:/git/streamcraft.tts
STREAMCRAFT_API_HOST=localhost
STREAMCRAFT_API_PORT=8010
STREAMCRAFT_WHISPER_MODEL=large-v3
STREAMCRAFT_WHISPER_LANGUAGE=en
STREAMCRAFT_WHISPER_COMPUTE_TYPE=float16
STREAMCRAFT_THREADS=8
STREAMCRAFT_USE_DEMUCS=false
```
UI settings (in `ui/react/.env`):
```env
VITE_API_BASE=http://localhost:8010/api
VITE_USE_MOCK=false
```

## API Endpoints
Current FastAPI routes (stubs returning mock data until wired to core services):
- `GET /health` — health check.
- `GET /api/vod/check?vod_url=...` — fetch VOD metadata or validate local path.
- `POST /api/audio/run` — extract audio from VOD or file.
- `POST /api/sanitize/run` — run silence trimming and optional demucs.
- `POST /api/srt/run` — transcribe to SRT/VTT/TXT.
- `POST /api/tts/run` — generate TTS or kick off fine-tune (placeholder).

API response schemas live in [backend/streamcraft/models/api.py](backend/streamcraft/models/api.py). Future plans include background jobs with polling and log streaming.

## CLI Usage
After `./build.ps1` activate the venv and use the Typer CLI:
```powershell
./.venv/Scripts/Activate.ps1
streamcraft pipeline --vod "https://www.twitch.tv/videos/123456"
```
Common flags:
- `--vod` Twitch URL or local media path (required).
- `--outdir` and `--dataset-out` to override output roots (defaults derive from streamer name).
- `--model` faster-whisper model, default `large-v3`.
- `--language` ISO code or `auto`, default `en`.
- `--compute-type` quantization (float16 default, int8 for CPU).
- `--threads` CPU threads for transcription.
- `--force` re-download and re-slice even if artifacts exist.
- `--use-demucs` enable vocal isolation.
- `--min-speech-ms`, `--max-clip-sec`, `--pad-ms`, `--merge-gap-ms` control slicing.
- `--mux-subs` mux SRT back into MP4 for preview.
- `--vod-quality` twitchdl quality preset (default `audio_only`).

Run `streamcraft pipeline --help` for the full surface.

## UI Stack and Development Notes
- React + Vite + Tailwind with Pico baseline for sensible defaults.
- Component and interaction rules are defined in [docs/uispec.md](docs/uispec.md) (layout, spacing, states, tokens, accessibility).
- API client is centralized in [ui/react/src/api/client.ts](ui/react/src/api/client.ts); switch between mock and live via `VITE_USE_MOCK`.
- Accessibility: keyboard focus, Esc to close overlays, aria-live for progress, visible focus rings.
- Testing guidance: add smoke tests for main wizard render, snapshot for static sections, integration with mock API for happy path.

## Jobs, Logging, and Observability
- Planned: background job runner with persistent job ids, per-step timestamps, and resumable runs.
- Logging: structured logs to `jobs/logs/<jobId>.log` plus console streaming in UI (future). For now, rely on terminal output and mock responses.
- Metrics: hook points for duration per step, model used, clip counts, errors. No external exporter yet.

## Error Handling and Recovery
- Inline errors per step with retry actions; keep user input intact.
- Copy log action (future) for failed jobs.
- Validation rules: require valid URL/file; enforce numeric bounds for sanitize parameters; confirm before discarding review changes.
- Network/API failures should surface as toast plus inline card message with retry.

## TTS and Voice Lab
Legacy scripts in [scripts](scripts) cover cloning and training until UI wiring is complete.

### Quick voice clone
```powershell
./scripts/tts-generate.ps1 -Text "Hello" -SpeakerAudio "dataset/streamer/clips/000001.m4a" -OutputFile "output/clone.wav"
```
Or average embeddings from multiple clips:
```powershell
./scripts/tts-generate.ps1 -Text "Hello" -SpeakerDataset "dataset/streamer" -SpeakerClipCount 100 -OutputFile "output/clone.wav"
```

### Fine-tune XTTS
```powershell
./scripts/finetune-xtts.ps1 -DatasetDir "dataset/streamer" -Steps 1000
```

### Train custom model
```powershell
./scripts/train-tts.ps1 -DatasetDir "dataset/streamer" -Model "xtts" -Epochs 100
```
See [TTS_TRAINING.md](TTS_TRAINING.md) for detailed guidance. Voice Lab UI will later expose these flows with presets and A/B listening.

## Quality and Dataset Guidance
- Prefer clean speech sources; avoid heavy background music. Demucs helps isolate vocals but adds compute time.
- Keep clip durations 2–12 seconds for general TTS; adjust `--max-clip-sec` to 18–20 if you need longer utterances.
- Use `--min-speech-ms` around 1200 ms and `--pad-ms` 200–300 ms for natural edges; tune `--merge-gap-ms` 400–600 ms to avoid over-fragmentation.
- Review overlay should be used to drop noisy or misaligned clips before training.

## Security and Privacy Notes
- Single-user, local-first; no authentication is implemented. If exposing beyond localhost, add auth and TLS at the proxy layer.
- VOD URLs are fetched directly; ensure you have rights to process the content.
- Artifacts are stored locally; nothing is uploaded to third-party services unless you configure such behavior.

## Performance Guidance
- CUDA strongly recommended. For CPU runs, set `--compute-type int8` and reduce model size to `small` or `medium`.
- Use `--threads` to match your CPU cores; 8 is a good default.
- Demucs significantly increases runtime; disable unless necessary.
- Cache models persist under user cache; first run downloads may be large.

## Testing and QA Approach
- Unit coverage for core modules (dataset slicing, path resolution, transcription wrappers).
- API contract tests once routes are wired.
- UI smoke tests and integration with mocked API for the happy path (VOD check → transcribe → review → export).
- Manual exploratory: invalid URLs, network drop during transcription, long VODs, demucs on/off, clip review with bulk reject.

## Roadmap and Future Work
- Wire API routes to core services with background jobs and polling.
- Job queue UI with cancel/retry and log streaming.
- Voice Lab UI with quick clone and XTTS training presets.
- Persisted settings per streamer and last-run recall.
- Waveform preview and audio playback in review overlay.
- Auth and role support for multi-user deployments.
- Metrics/exporters for Prometheus or OpenTelemetry.

## FAQ
- **Do I need a GPU?** Recommended. CPU works with smaller models and int8 quantization but will be slower.
- **Where do files go?** VOD artifacts under `out/<streamer>/vods/<vodId>/`, clips under `dataset/<streamer>/clips/`, manifests alongside clips.
- **Can I rerun on the same VOD?** Yes; use `--force` to overwrite or let existing artifacts be reused when supported.
- **How do I change ports?** Use `-BackendPort` and `-UiPort` flags on `run_dev.ps1` or set `STREAMCRAFT_API_PORT` and `VITE_API_BASE`.
- **Is the UI usable without backend?** Yes, with `VITE_USE_MOCK=true` for demo and layout work.

## Glossary
- **VOD:** Video on demand from Twitch.
- **Demucs:** Model for music source separation to isolate vocals.
- **Whisper:** Speech-to-text model (faster-whisper implementation).
- **Clip:** Audio segment produced from transcript timestamps.
- **Manifest:** CSV/JSON listing clip metadata for training.
- **Voice Lab:** Future UI area for cloning and training TTS voices.

---
For UI behavior, spacing, and interaction rules see [docs/uispec.md](docs/uispec.md). For legacy script migration notes, see [scripts/README.md](scripts/README.md). Questions or issues? Open an issue or start a discussion.
