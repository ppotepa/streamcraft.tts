"""Job route handlers."""

import asyncio
import shutil
from pathlib import Path

from fastapi import HTTPException

from streamcraft.api.common.paths import to_workspace_relative
from streamcraft.models.api import CreateJobRequest, JobResponse, UpdateJobRequest


async def create_job(request: CreateJobRequest) -> JobResponse:
    """Create a legacy job entry for the wizard."""
    from streamcraft.jobs.storage import create_job as create_job_storage

    streamer = (request.streamer or "unknown").strip() or "unknown"
    title = (request.title or "Untitled").strip() or "Untitled"
    return await asyncio.to_thread(create_job_storage, request.vodUrl, streamer, title)


async def get_jobs() -> list[JobResponse]:
    """Get all jobs."""
    from streamcraft.jobs.storage import get_all_jobs

    return await asyncio.to_thread(get_all_jobs)


async def get_job(job_id: str) -> JobResponse:
    """Get a single job by ID."""
    from streamcraft.jobs.storage import get_job as get_job_by_id

    job = await asyncio.to_thread(get_job_by_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def update_job(job_id: str, request: UpdateJobRequest) -> JobResponse:
    """Update a job."""
    from streamcraft.jobs.storage import update_job as update_job_storage

    job = await asyncio.to_thread(update_job_storage, job_id, request.steps, request.outputs)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def delete_job(job_id: str) -> dict:
    """Delete a job."""
    from streamcraft.jobs.storage import delete_job as delete_job_storage

    success = await asyncio.to_thread(delete_job_storage, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "deleted"}


async def purge_job(job_id: str) -> dict:
    """Delete a job and remove its VOD artifacts."""
    from streamcraft.core.pipeline import resolve_output_dirs
    from streamcraft.jobs.storage import delete_job as delete_job_storage
    from streamcraft.jobs.storage import get_job as get_job_storage

    job = await asyncio.to_thread(get_job_storage, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    out_root = Path("out")
    dataset_root = Path("dataset")
    run_id = job.outputs.runId if job.outputs else None
    _, vod_dir, dataset_dir = resolve_output_dirs(job.vodUrl, out_root, dataset_root, run_id=run_id)

    removed: list[str] = []
    if vod_dir.exists():
        shutil.rmtree(vod_dir, ignore_errors=True)
        removed.append(to_workspace_relative(vod_dir))

    vod_slug = vod_dir.name
    segment_manifest = dataset_dir / f"{vod_slug}_segments.json"
    review_manifest = dataset_dir / f"{vod_slug}_segment_review.json"
    for path in (segment_manifest, review_manifest):
        if path.exists():
            try:
                path.unlink()
                removed.append(to_workspace_relative(path))
            except Exception:
                pass

    await asyncio.to_thread(delete_job_storage, job_id)
    return {"status": "deleted", "removed": removed}
