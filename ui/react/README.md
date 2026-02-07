# Streamcraft React UI

React + Vite reimplementation of the Streamcraft wizard (VOD → audio → sanitization → SRT → TTS). The UI defaults to mock API responses so it runs without a backend; point it at a real API when ready.

## Quickstart

1) `cd ui/react`
2) `npm install`
3) `npm run dev`

Open the printed localhost URL (default http://localhost:5173).

## Configuration

Set environment variables in a `.env` file in `ui/react`:

- `VITE_USE_MOCK=false` to call a real API (defaults to true).
- `VITE_API_BASE=http://localhost:5200/api` to target your backend.

Expected endpoints when `VITE_USE_MOCK=false`:
- `POST /vod/check` `{ url } -> { streamer, title, duration, previewUrl, vodId }`
- `POST /audio/extract` `{ vodUrl, force, useDemucs, skipAac } -> { exitCode, path, log[] }`
- `POST /audio/sanitize` `{ vodUrl } -> { exitCode, cleanPath, segmentsPath, log[] }`
- `POST /srt/extract` `{ vodUrl } -> { exitCode, path, lines, excerpt, log[] }`
- `POST /tts/generate` `{ vodUrl, text, streamer } -> { exitCode, outputPath, log[] }`

## Notes

- UI mirrors the maquette: left rail steps, right pane surfaces, acceptance pills, pinned previews.
- Dataset is auto-derived from streamer: `dataset/<streamer>/clips`.
- Logs modal is fed from each step; mock mode returns canned logs for visibility.
