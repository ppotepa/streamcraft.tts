"""Diarization route handlers."""

import asyncio
import json
import subprocess
from pathlib import Path

from fastapi import HTTPException

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import WORKSPACE_ROOT, to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.models.api import RunDiarizationRequest, RunDiarizationResponse
from streamcraft.settings import get_settings


async def run_diarization(request: RunDiarizationRequest) -> RunDiarizationResponse:
    """Run diarization for target-speaker filtering and save labels under run/asr."""
    from streamcraft.core.pipeline import resolve_output_dirs

    run_id = require_run_id_or_400(request.runId, "/diarization/run")
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)
    vod_slug = vod_dir.name

    clean_audio = vod_dir / f"{vod_slug}_clean.wav"
    if not clean_audio.exists():
        raise HTTPException(status_code=400, detail="Clean audio missing; run sanitize first")

    asr_dir = dataset_dir / "asr"
    asr_dir.mkdir(parents=True, exist_ok=True)
    labels_path = asr_dir / "diarization.json"

    settings = get_settings()
    script = (settings.diarization_script_path or "").strip()
    if not script:
        labels_payload = {
            "status": "unavailable",
            "reason": "STREAMCRAFT_DIARIZATION_SCRIPT_PATH not configured",
            "segments": [],
        }
        labels_path.write_text(json.dumps(labels_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        merge_run_stage_artifacts(
            vod_url=request.vodUrl,
            out_root=out_root,
            dataset_root=dataset_root,
            run_id=run_id,
            stage="diarization",
            payload={"labelsPath": to_workspace_relative(labels_path), "status": "unavailable", "speakerCount": 0},
        )
        return RunDiarizationResponse(
            labelsPath=to_workspace_relative(labels_path),
            speakerCount=0,
            exitCode=0,
            log=["Diarization script not configured; wrote unavailable marker"],
        )

    script_path = Path(script)
    if not script_path.is_absolute():
        script_path = (WORKSPACE_ROOT / script_path).resolve()
    if not script_path.exists():
        raise HTTPException(status_code=500, detail=f"Diarization script not found: {script_path}")

    command = [
        "pwsh",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script_path),
        "-InputAudio",
        str(clean_audio),
        "-OutputJson",
        str(labels_path),
    ]

    result = await asyncio.to_thread(
        subprocess.run,
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    log_lines: list[str] = []
    if result.stdout:
        log_lines.extend([line for line in result.stdout.splitlines() if line.strip()])
    if result.stderr:
        log_lines.extend([f"stderr: {line}" for line in result.stderr.splitlines() if line.strip()])
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Diarization failed")
    if not labels_path.exists():
        raise HTTPException(status_code=500, detail="Diarization output not created")

    labels = json.loads(labels_path.read_text(encoding="utf-8"))
    speakers = {entry.get("speaker") for entry in labels.get("segments") or [] if entry.get("speaker")}
    merge_run_stage_artifacts(
        vod_url=request.vodUrl,
        out_root=out_root,
        dataset_root=dataset_root,
        run_id=run_id,
        stage="diarization",
        payload={"labelsPath": to_workspace_relative(labels_path), "status": "done", "speakerCount": len(speakers)},
    )
    return RunDiarizationResponse(
        labelsPath=to_workspace_relative(labels_path),
        speakerCount=len(speakers),
        exitCode=0,
        log=log_lines[-400:],
    )
