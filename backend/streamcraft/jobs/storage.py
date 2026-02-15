"""Simple file-based job storage."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from streamcraft.models.api import JobResponse, JobSteps, JobOutputs
from streamcraft.core.pipeline import generate_run_id

JOBS_FILE = Path("temp") / "jobs.json"


def _ensure_jobs_file() -> None:
    """Create jobs file if it doesn't exist."""
    JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not JOBS_FILE.exists():
        JOBS_FILE.write_text(json.dumps([], indent=2))


def _read_jobs() -> List[Dict]:
    """Read all jobs from file."""
    _ensure_jobs_file()
    try:
        with open(JOBS_FILE, 'r') as f:
            jobs = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

    changed = False
    for job in jobs:
        outputs = job.get("outputs") or {}
        if not outputs.get("runId"):
            outputs["runId"] = generate_run_id()
            job["outputs"] = outputs
            changed = True

    if changed:
        _write_jobs(jobs)

    return jobs


def _write_jobs(jobs: List[Dict]) -> None:
    """Write all jobs to file."""
    _ensure_jobs_file()
    with open(JOBS_FILE, 'w') as f:
        json.dump(jobs, f, indent=2)


def get_all_jobs() -> List[JobResponse]:
    """Get all jobs."""
    jobs_data = _read_jobs()
    result = []
    for j in jobs_data:
        try:
            # Handle both old and new format
            vod_url = j.get("vodUrl") or j.get("vod_url", "")
            created_at = j.get("createdAt") or j.get("created", "")
            updated_at = j.get("updatedAt") or j.get("updated", created_at)
            
            # Skip old-format jobs that don't have required new fields
            if "steps" not in j:
                continue
                
            result.append(JobResponse(
                id=j["id"],
                vodUrl=vod_url,
                streamer=j.get("streamer", "unknown"),
                title=j.get("title", "Untitled"),
                createdAt=created_at,
                updatedAt=updated_at,
                steps=JobSteps(**j.get("steps", {})),
                outputs=JobOutputs(**j.get("outputs", {})) if j.get("outputs") else None,
            ))
        except Exception:
            # Skip malformed jobs silently
            continue
    return result


def get_job(job_id: str) -> Optional[JobResponse]:
    """Get a single job by ID."""
    jobs = _read_jobs()
    for j in jobs:
        if j["id"] == job_id:
            return JobResponse(
                id=j["id"],
                vodUrl=j["vodUrl"],
                streamer=j["streamer"],
                title=j["title"],
                createdAt=j["createdAt"],
                updatedAt=j["updatedAt"],
                steps=JobSteps(**j.get("steps", {})),
                outputs=JobOutputs(**j.get("outputs", {})) if j.get("outputs") else None,
            )
    return None


def create_job(vod_url: str, streamer: str, title: str) -> JobResponse:
    """Create a new job."""
    jobs = _read_jobs()
    job_id = f"job-{len(jobs) + 1}-{int(datetime.now().timestamp())}"
    now = datetime.now().isoformat()
    run_id = generate_run_id()
    
    job_data = {
        "id": job_id,
        "vodUrl": vod_url,
        "streamer": streamer,
        "title": title,
        "createdAt": now,
        "updatedAt": now,
        "steps": {"vod": True, "audio": False, "sanitize": False, "srt": False, "train": False, "tts": False},
        "outputs": {"runId": run_id},
    }
    
    jobs.append(job_data)
    _write_jobs(jobs)
    
    return JobResponse(
        id=job_id,
        vodUrl=vod_url,
        streamer=streamer,
        title=title,
        createdAt=now,
        updatedAt=now,
        steps=JobSteps(**job_data["steps"]),
        outputs=JobOutputs(**job_data["outputs"]),
    )


def update_job(
    job_id: str, 
    steps: Optional[JobSteps] = None, 
    outputs: Optional[JobOutputs] = None
) -> Optional[JobResponse]:
    """Update a job."""
    jobs = _read_jobs()
    for i, j in enumerate(jobs):
        if j["id"] == job_id:
            now = datetime.now().isoformat()
            j["updatedAt"] = now
            
            if steps:
                j["steps"] = steps.model_dump()
            if outputs:
                next_outputs = dict(j.get("outputs") or {})
                next_outputs.update(outputs.model_dump(exclude_none=True))
                j["outputs"] = next_outputs
            
            jobs[i] = j
            _write_jobs(jobs)
            
            return JobResponse(
                id=j["id"],
                vodUrl=j["vodUrl"],
                streamer=j["streamer"],
                title=j["title"],
                createdAt=j["createdAt"],
                updatedAt=now,
                steps=JobSteps(**j["steps"]),
                outputs=JobOutputs(**j["outputs"]) if j.get("outputs") else None,
            )
    return None


def delete_job(job_id: str) -> bool:
    """Delete a job."""
    jobs = _read_jobs()
    filtered = [j for j in jobs if j["id"] != job_id]
    if len(filtered) < len(jobs):
        _write_jobs(filtered)
        return True
    return False
