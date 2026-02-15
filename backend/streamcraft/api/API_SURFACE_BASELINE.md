# API Surface Baseline (pre-split)

This baseline records the current legacy API contract mounted from `streamcraft.api.legacy_routes`.

## Endpoints (28)

- POST /vod/check
- POST /audio/run
- POST /sanitize/run
- POST /diarization/run
- POST /jobs/{job_id}/cancel
- GET /sanitize/segments
- POST /dataset/build
- POST /model/train
- GET /model/train/jobs
- GET /model/train/jobs/{job_id}
- POST /model/train/jobs/{job_id}/cancel
- POST /model/train/jobs/{job_id}/retry
- GET /sanitize/review
- POST /sanitize/review
- POST /sanitize/export-clips
- POST /srt/run
- POST /srt/transcribe-segment
- POST /tts/run
- GET /datasets/streamers
- GET /datasets
- GET /datasets/{dataset_id}
- POST /jobs
- GET /jobs
- GET /jobs/{job_id}
- PUT /jobs/{job_id}
- DELETE /jobs/{job_id}
- DELETE /jobs/{job_id}/purge
- GET|HEAD /artifact

## Request/response model source

- Main schema source: `backend/streamcraft/models/api.py`
- Legacy endpoint implementations: `backend/streamcraft/api/legacy_routes.py`

## Migration rule

- While splitting into modular routers, preserve path + method + payload schema + status-code behavior.
