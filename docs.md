# Streamcraft Wizard – UX and Flow

## Purpose and Layout
- Two-pane layout: left rail shows steps with state (active, done, locked); right pane shows only the current step.
- Progression is linear: one primary action (Next or Generate) per step; no Back buttons.
- Per-streamer folders: inputs/outputs live under `dataset/<streamer>/clips` and `out/<streamer>/vods/<vodid>/`; audio lives in `out/<streamer>/audio/`.
- A floating "Show logs" button opens a modal with a compact scrollable log area. The main pane avoids large log blocks.
- Animations: gentle fade + small upward slide on step/panel entry (~200–250ms). Inputs and buttons disable while work is running.

## Steps (current implementation in Blazor)
1) VOD Check
- Input: Twitch VOD URL.
- Actions: optional flags (Force re-run, Demucs, Skip AAC); Check VOD.
- States: empty (Next disabled), loading metadata, ready (metadata card with streamer/title/duration/preview link), Next enabled only when metadata is present. Ready state shows the Twitch preview thumbnail so the user can visually confirm the VOD.

2) Audio Extraction (pending refactor of the old pipeline step)
- Goal: produce `out/<streamer>/audio/<vodid>.wav`; gates on exit 0 + file exists.
- UI: primary "Extract audio" button, compact progress/log preview.

3) Audio Sanitization & Curation (replaces dataset list)
- Goal: produce `out/<streamer>/audio/<vodid>.clean.wav` plus curation manifest.
- Modes: auto sanitize vs manual curate (keep/discard segments, presets).

4) SRT/Text Extraction (new)
- Goal: produce `out/<streamer>/vods/<vodid>/<vodid>.srt` from the sanitized audio.

5) TTS
- Dataset is auto-picked from the streamer’s folder; user only supplies text. Shows last output path.

## Planned flow updates (to align with new requirements)
1) VOD Check (unchanged from above).
2) Audio Extraction (replace current pipeline step)
- Goal: extract a single audio file from the VOD; no slicing/SRT yet.
- Acceptance: exit code 0 and extracted audio file exists (non-zero length).
- UI: one primary "Extract audio" button, compact progress text/log preview, output path summary when done; Next enabled only when audio is ready. Keep the VOD preview thumbnail pinned (small) in the pane for visual confirmation of the source.

3) Audio Sanitization & Curation (replace current dataset step)
- Goal: clean and optionally curate the extracted audio before transcription.
- Modes:
  - Auto sanitize: one-click noise reduction/leveling/voice-focus; produces a polished full track.
  - Manual curate: audition, keep/discard segments, apply presets (e.g., noise cut, voice focus), then export polished track.
- Artifacts: `out/<streamer>/audio/<vodid>.clean.wav` plus `out/<streamer>/audio/<vodid>.segments.json` (kept/dropped markers). If the user chooses "use full sanitized track," record that in the manifest.
- Acceptance: polished audio produced and valid (non-zero, not silent). If manual, at least one kept segment or explicit "use full sanitized track" choice.
- UI: choose auto vs manual; show compact progress/logs; allow preview/play of sanitized output; enable Next once polished track exists.

4) SRT/Text Extraction (new step after sanitization)
- Goal: run transcription on the polished track.
- UI: small progress bar/text; recent line preview in a compact scrollable box; Next enabled when SRT completes and lines > 0.
- Acceptance: SRT file present; line count > 0; exit code 0.

5) TTS (unchanged conceptually)
- Goal: generate speech from the streamer’s dataset + text (dataset auto-picked per streamer folder).
- Acceptance: text present, generate exit code 0.
- UI: textarea, Generate; show last output path with copy/play affordances.

## Logs
- Accessed via floating "Show logs" button; modal with scrollable content, auto-scroll to bottom while preserving manual scroll if the user pauses.
- In-panel snippets remain compact (5–7 lines max) to avoid layout bloat.
- Per-step log files (paths per streamer): `out/<streamer>/vods/<vodid>/logs/extract.log`, `sanitize.log`, `srt.log`, `tts.log`.

## Future screen: Data Browser / Visual Editor
- Separate from the per-VOD wizard.
- Lets users browse existing datasets, inspect clips, and visually adjust key samples (waveform/clip grid, play/keep/discard, light filters).
- Uses similar two-pane structure: left list (datasets/voices), right workspace (clip grid + waveform + metadata fields).

## Maquettes (SVG) inventory
- layout.svg, wizard-layout.svg: overall two-pane structure with rail + current step.
- step1-vod-states.svg: VOD empty/loading/ready.
- step2-pipeline-states.svg: audio extraction locked/running/completed.
- step3-dataset-states.svg: audio sanitization locked/running/completed.
- step4-tts-states.svg: TTS locked/ready/generated.
- (Planned) step4b-srt-states.svg: SRT/Text extraction locked/running/completed.

## Acceptance gating summary (planned)
- Step 1: metadata fetched.
- Step 2: `out/<streamer>/audio/<vodid>.wav` exists (non-zero) and exit 0.
- Step 3: `out/<streamer>/audio/<vodid>.clean.wav` exists (non-zero) + `out/<streamer>/audio/<vodid>.segments.json` present; exit 0.
- Step 4: `out/<streamer>/vods/<vodid>/<vodid>.srt` exists, lines > 0, exit 0.
- Step 5: TTS generated, exit 0 (dataset auto-picked per streamer).
