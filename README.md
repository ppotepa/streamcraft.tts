# Streamcraft TTS (Python-first)

Python-only pipeline for Twitch VOD → SRT → TTS voice dataset + Voice Cloning. PowerShell is optional via `run_pipeline.ps1`.

## Quick Start

### 1. Transcribe VOD & Generate Dataset (CUDA only)
```powershell
# One-click run (prompts if -VodUrl is omitted)
.\run_pipeline.ps1 -VodUrl "https://www.twitch.tv/videos/XXXXX"

# Advanced CUDA helper with sampling controls
.\win-cuda.ps1 -VodUrl "https://www.twitch.tv/videos/XXXXX" -Fraction 0.25
```

### 2. Voice Cloning & TTS
```powershell
# Interactive TTS menu (choose models, generate speech, train)
.\run_tts.ps1
```

## Quick start (PowerShell)
```powershell
# Full pipeline in one command
./run_pipeline.ps1 -VodUrl https://www.twitch.tv/videos/2689875280 -Force
```

Under the hood `run_pipeline.ps1` simply launches `python -m src.pipeline --vod ...`. Supplying a Twitch URL automatically routes artifacts to `out/<streamer>/vods/<vodId>` and `dataset/<streamer>` based on the video owner information, so you never have to type the streamer name.

### What the command actually does
1. **Download** – `twitchdl` pulls the VOD into `out/<streamer>/vods/<vodId>/<vodId>.mp4` using the `--vod-quality` you selected (defaults to `audio_only`).
2. **Extract audio** – `ffmpeg` creates a single 48 kHz stereo master `<vodId>_full.wav` (this feeds both transcription and dataset slicing).
3. **Transcribe on CUDA** – `faster-whisper` runs on GPU (`--model large-v3 --compute-type float16` by default) and streams progress to the console. When it finishes you will see `[OK] Transcribed N segments` and the folder now contains `.srt`, `.vtt`, `.txt`, and `.meta.json` files.
4. **Slice clips** – `dataset.py` parses the SRT, merges short gaps, pads timestamps, and calls `ffmpeg` to export numbered clips into `dataset/<streamer>/clips/`. Each clip gets:
	- `<clipId>.wav` (48 kHz PCM master)
	- `<clipId>.m4a` (optional high-bitrate AAC mirror, disable with `--no-clip-aac`)
	- Entries appended to `manifest.csv` and `segments.json` with timing + text.
5. **Repeat-safe layout** – Clip numbering auto-continues, so running the same streamer multiple times keeps aggregating into the same dataset directory without overwriting unless you pass `-Force`.

If step 3 fails (e.g., `cublas64_12.dll` missing), step 4 never runs. Install the CUDA wheels inside `.venv`:

```powershell
.\.venv\Scripts\pip install --upgrade "ctranslate2>=4.2.0" --extra-index-url https://download.pytorch.org/whl/cu124
.\.venv\Scripts\pip install nvidia-cublas-cu12==12.4.5.8 nvidia-cuda-runtime-cu12==12.4.127 nvidia-cudnn-cu12==9.1.0.70
```

Then re-run `run_pipeline.ps1` and confirm the log shows `Exported … clips to dataset/<streamer>/clips` at the end.

## Quick start (pure Python)
```bash
python -m venv .venv
./.venv/Scripts/pip install -U pip
./.venv/Scripts/pip install -r requirements.txt
PYTHONPATH=.
./.venv/Scripts/python -m src.pipeline \
	--vod https://www.twitch.tv/videos/2689875280 \
	--outdir out \
	--dataset-out dataset \
	--model large-v3 --compute-type float16 --threads 8 --progress-interval 10 --force
```

## Key flags
- `--vod` Twitch URL or local media file (required)
- `--outdir` and `--dataset-out` base folders (default `out` / `dataset`, auto-grouped per streamer)
- `--model`, `--language`, `--threads`, `--compute-type`, `--progress-interval`, `--vod-quality` mirror faster-whisper knobs
- `--max-duration` trims long VODs without re-encoding the source first
- `--mux-subs` muxes the generated SRT back into the MP4 for preview
- `--force` re-downloads audio + overwrites any existing clips; combine with `--keep-existing-clips` when you want to skip duplicates
- `--use-demucs`, `--min-speech-ms`, `--max-clip-sec`, `--pad-ms`, `--merge-gap-ms`, `--min-rms-db`, `--ds-threads` control dataset slicing
- `--no-clip-aac` plus `--clip-aac-bitrate` manage the AAC mirrors that accompany each 48 kHz WAV clip

## Data Layout
- Each streamer lives under `dataset/<streamer>/`.
- Every VOD gets its own bucket inside `out/<streamer>/vods/<vodId>/` containing the single 48 kHz stereo master (`*_full.wav`), SRT/VTT/TXT, and metadata.
- Running the `full` pipeline with a Twitch URL automatically builds these streamer/VOD folders using the video owner metadata, so you never have to type `<streamer>` manually.
- Aggregated training clips live in `dataset/<streamer>/clips/` with `manifest.csv` and `segments.json` accumulating entries across all processed VODs. Each clip now ships with a 48 kHz WAV plus a matching high-bitrate AAC (`.m4a`) copy so you can choose between fidelity and compatibility. Clip numbering automatically continues so multiple videos can be merged safely.
- Generated TTS audio can follow the same convention (e.g., `output/<streamer>/tts/<timestamp>.wav`) to keep experiments organized per voice.

## TTS & Voice Cloning

### Interactive Menu
```powershell
.\run_tts.ps1
```
Features:
- Generate speech with voice cloning (instant, no training needed!)
- Fine-tune XTTS on your dataset
- Train custom TTS models
- List available models and datasets
- Test voice quality

### Quick Voice Clone (No Training)
```powershell
# Use a single reference clip
\.\tts-generate.ps1 -Text "Your text here" -SpeakerAudio "dataset\streamer\clips\000001.m4a" -OutputFile "output\clone.wav"

# Or let it pick the best clip from a prepared dataset
.\tts-generate.ps1 -Text "Your text here" -SpeakerDataset "dataset\streamer" -OutputFile "output\clone.wav"

# Use multiple dataset clips (averages embeddings for better stability)
.\tts-generate.ps1 -Text "Your text here" -SpeakerDataset "dataset\streamer" -SpeakerClipCount 100 -OutputFile "output\clone.wav"
```
> First run downloads the CUDA PyTorch + TTS stack into `.venv-tts` using `py -3.11`. Subsequent runs reuse the cached environment automatically.

### Fine-tune for Better Quality
```powershell
.\finetune-xtts.ps1 -DatasetDir "dataset\streamer" -Steps 1000
```

### Train Custom Model
```powershell
.\train-tts.ps1 -DatasetDir "dataset\streamer" -Model "xtts" -Epochs 100
```

See [TTS_TRAINING.md](TTS_TRAINING.md) for detailed guide.

## Notes
- Requires ffmpeg on PATH.
- Installs twitchdl, faster-whisper, numpy, soundfile, webrtcvad. Demucs is optional; uncomment in requirements if desired.
- CUDA is required; the CLI aborts immediately if GPU libraries are missing.
