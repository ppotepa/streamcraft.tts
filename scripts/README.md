# Legacy Scripts

These PowerShell scripts are legacy helpers that may reference old paths or be replaced by the Python CLI (`streamcraft`) in future versions.

## Scripts

- `run_pipeline.ps1` - Legacy pipeline wrapper (use `streamcraft pipeline` instead)
- `run_tts.ps1` - TTS menu (still active)
- `tts-generate.ps1` - Quick voice clone (still active)
- `train-tts.ps1` - Train custom TTS model
- `finetune-xtts.ps1` - Fine-tune XTTS
- `win-cuda.ps1` - CUDA-specific pipeline helper
- `win-cpu.ps1` - CPU-only pipeline helper (deprecated)
- `transcript.ps1` - Standalone transcription helper
- `tts.ps1` - TTS helper

## Migration Note

Most functionality is now available via:
- `streamcraft pipeline` (CLI from backend package)
- FastAPI routes in `backend/streamcraft/api/`

These scripts remain for compatibility and special workflows.
