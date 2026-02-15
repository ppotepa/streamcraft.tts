"""Model training route handlers."""

import asyncio
import datetime
import json
from pathlib import Path
from typing import Literal, cast

from fastapi import HTTPException

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.models.api import (
    ModelTrainJobListResponse,
    ModelTrainJobResponse,
    ModelTrainRequest,
    ModelTrainResponse,
)


async def run_model_train(request: ModelTrainRequest) -> ModelTrainResponse:
    """Queue a real model training job and return checkpoint metadata."""
    from streamcraft.core.pipeline import generate_run_id, resolve_output_dirs
    from streamcraft.jobs.model_training import enqueue_training_job

    run_id = require_run_id_or_400(request.runId, "/model/train")
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    model_root = Path(request.modelOut or "models")

    streamer_slug, _, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)
    manifest_jsonl = dataset_dir / "manifest.jsonl"
    if not manifest_jsonl.exists():
        raise HTTPException(status_code=400, detail="manifest.jsonl missing; run /dataset/build first")

    checkpoint_id = generate_run_id()
    checkpoint_dir = model_root / streamer_slug / checkpoint_id
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = checkpoint_dir / "training_manifest.json"

    payload = {
        "checkpointId": checkpoint_id,
        "status": "queued",
        "runId": run_id,
        "vodUrl": request.vodUrl,
        "streamer": streamer_slug,
        "baseModel": request.baseModel,
        "epochs": request.epochs,
        "datasetManifest": to_workspace_relative(manifest_jsonl),
        "createdAt": datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z"),
        "note": "queued for training worker",
    }
    metadata_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    job = enqueue_training_job(
        run_id=run_id,
        vod_url=request.vodUrl,
        streamer_slug=streamer_slug,
        checkpoint_id=checkpoint_id,
        checkpoint_dir=checkpoint_dir,
        metadata_path=metadata_path,
        dataset_manifest=manifest_jsonl,
        base_model=request.baseModel,
        epochs=request.epochs,
    )

    merge_run_stage_artifacts(
        vod_url=request.vodUrl,
        out_root=out_root,
        dataset_root=dataset_root,
        run_id=run_id,
        stage="modelTrain",
        payload={
            "jobId": job["id"],
            "checkpointId": checkpoint_id,
            "checkpointPath": to_workspace_relative(checkpoint_dir),
            "metadataPath": to_workspace_relative(metadata_path),
            "status": "queued",
        },
    )

    return ModelTrainResponse(
        jobId=str(job["id"]),
        checkpointId=checkpoint_id,
        status="queued",
        checkpointPath=to_workspace_relative(checkpoint_dir),
        metadataPath=to_workspace_relative(metadata_path),
        log=[f"Training job queued: {job['id']}", "Checkpoint metadata created"],
    )


def _to_model_train_job_response(job: dict) -> ModelTrainJobResponse:
    raw_status = str(job.get("status") or "queued")
    status = cast(
        Literal["queued", "running", "failed", "done", "canceled"],
        raw_status if raw_status in {"queued", "running", "failed", "done", "canceled"} else "queued",
    )
    return ModelTrainJobResponse(
        id=str(job.get("id")),
        status=status,
        createdAt=str(job.get("created_at") or ""),
        updatedAt=str(job.get("updated_at") or ""),
        runId=str(job.get("run_id") or ""),
        vodUrl=str(job.get("vod_url") or ""),
        streamer=str(job.get("streamer_slug") or ""),
        checkpointId=str(job.get("checkpoint_id") or ""),
        checkpointPath=to_workspace_relative(Path(str(job.get("checkpoint_dir") or ""))),
        metadataPath=to_workspace_relative(Path(str(job.get("metadata_path") or ""))),
        datasetManifest=to_workspace_relative(Path(str(job.get("dataset_manifest") or ""))),
        progress=int(job.get("progress") or 0),
        error=job.get("error"),
        log=list(job.get("log") or []),
    )


async def list_model_train_jobs(limit: int = 50) -> ModelTrainJobListResponse:
    from streamcraft.jobs.model_training import list_training_jobs

    jobs = await asyncio.to_thread(list_training_jobs, limit)
    items = [_to_model_train_job_response(job) for job in jobs]
    return ModelTrainJobListResponse(items=items, total=len(items))


async def get_model_train_job(job_id: str) -> ModelTrainJobResponse:
    from streamcraft.jobs.model_training import get_training_job

    job = await asyncio.to_thread(get_training_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Model training job not found")
    return _to_model_train_job_response(job)


async def cancel_model_train_job(job_id: str) -> ModelTrainJobResponse:
    from streamcraft.jobs.model_training import cancel_training_job, get_training_job

    ok = await asyncio.to_thread(cancel_training_job, job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Model training job not found")
    job = await asyncio.to_thread(get_training_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Model training job not found")
    return _to_model_train_job_response(job)


async def retry_model_train_job(job_id: str) -> ModelTrainJobResponse:
    from streamcraft.jobs.model_training import retry_training_job

    job = await asyncio.to_thread(retry_training_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Model training job not found")
    return _to_model_train_job_response(job)
