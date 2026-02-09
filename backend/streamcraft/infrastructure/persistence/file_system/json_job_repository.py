"""JSON file-based job repository implementation."""

import json
from pathlib import Path
from typing import Sequence

from streamcraft.domain.job.entities.job import Job, JobStep, create_job
from streamcraft.domain.job.errors.job_errors import JobNotFoundError
from streamcraft.domain.job.ports.job_repository import JobRepository
from streamcraft.domain.job.value_objects.job_status import (
    DoneStatus,
    ErrorStatus,
    IdleStatus,
    JobStatus,
    RunningStatus,
    create_done,
    create_error,
    create_idle,
    create_running,
)
from streamcraft.domain.job.value_objects.step_name import StepName
from streamcraft.domain.shared.branded_types import JobId, VodId, create_job_id, create_vod_id
from streamcraft.domain.shared.result import Failure, Result, Success, err, ok
from streamcraft.domain.shared.value_objects import Timestamp


class JsonJobRepository(JobRepository):
    """File-based job repository using JSON."""

    def __init__(self, file_path: Path) -> None:
        """Initialize repository with file path."""
        self._file_path = file_path
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        """Ensure the JSON file exists."""
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self._file_path.exists():
            self._file_path.write_text("[]")

    def _read_jobs(self) -> list[dict]:
        """Read all jobs from file."""
        try:
            with open(self._file_path, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write_jobs(self, jobs: list[dict]) -> None:
        """Write all jobs to file."""
        with open(self._file_path, "w") as f:
            json.dump(jobs, f, indent=2)

    def _serialize_status(self, status: JobStatus) -> dict:
        """Serialize job status to dict."""
        if isinstance(status, IdleStatus):
            return {"kind": "idle"}
        elif isinstance(status, RunningStatus):
            return {
                "kind": "running",
                "current_step": status.current_step,
                "progress": status.progress,
            }
        elif isinstance(status, DoneStatus):
            return {"kind": "done", "exit_code": status.exit_code}
        elif isinstance(status, ErrorStatus):
            return {"kind": "error", "message": status.message, "exit_code": status.exit_code}
        return {"kind": "idle"}

    def _deserialize_status(self, data: dict) -> JobStatus:
        """Deserialize job status from dict."""
        kind = data.get("kind", "idle")
        if kind == "idle":
            return create_idle()
        elif kind == "running":
            return create_running(
                current_step=data.get("current_step", ""),
                progress=data.get("progress", 0.0),
            )
        elif kind == "done":
            return create_done(exit_code=data.get("exit_code", 0))
        elif kind == "error":
            return create_error(
                message=data.get("message", ""),
                exit_code=data.get("exit_code", 1),
            )
        return create_idle()

    def _serialize_job(self, job: Job) -> dict:
        """Serialize job to dict."""
        return {
            "id": str(job.id),
            "vod_id": str(job.vod_id),
            "vod_url": job.vod_url,
            "status": self._serialize_status(job.status),
            "steps": [
                {
                    "name": step.name.value,
                    "status": self._serialize_status(step.status),
                    "started_at": step.started_at.to_iso() if step.started_at else None,
                    "completed_at": step.completed_at.to_iso() if step.completed_at else None,
                    "log_messages": list(step.log_messages),
                }
                for step in job.steps
            ],
            "created_at": job.created_at.to_iso(),
            "updated_at": job.updated_at.to_iso(),
        }

    def _deserialize_job(self, data: dict) -> Job:
        """Deserialize job from dict."""
        steps = tuple(
            JobStep(
                name=StepName(step_data["name"]),
                status=self._deserialize_status(step_data["status"]),
                started_at=(
                    Timestamp.from_iso(step_data["started_at"])
                    if step_data.get("started_at")
                    else None
                ),
                completed_at=(
                    Timestamp.from_iso(step_data["completed_at"])
                    if step_data.get("completed_at")
                    else None
                ),
                log_messages=tuple(step_data.get("log_messages", [])),
            )
            for step_data in data.get("steps", [])
        )

        return Job(
            id=create_job_id(data["id"]),
            vod_id=create_vod_id(data["vod_id"]),
            vod_url=data["vod_url"],
            status=self._deserialize_status(data["status"]),
            steps=steps,
            created_at=Timestamp.from_iso(data["created_at"]),
            updated_at=Timestamp.from_iso(data["updated_at"]),
        )

    def save(self, job: Job) -> Result[Job, Exception]:
        """Save a job."""
        try:
            jobs = self._read_jobs()
            job_dict = self._serialize_job(job)

            # Update or append
            found = False
            for i, existing in enumerate(jobs):
                if existing["id"] == str(job.id):
                    jobs[i] = job_dict
                    found = True
                    break

            if not found:
                jobs.append(job_dict)

            self._write_jobs(jobs)
            return ok(job)
        except Exception as e:
            return err(e)

    def find_by_id(self, job_id: JobId) -> Result[Job, JobNotFoundError]:
        """Find a job by ID."""
        try:
            jobs = self._read_jobs()
            for job_data in jobs:
                if job_data["id"] == str(job_id):
                    job = self._deserialize_job(job_data)
                    return ok(job)
            return err(JobNotFoundError(str(job_id)))
        except Exception:
            return err(JobNotFoundError(str(job_id)))

    def find_all(self) -> Result[Sequence[Job], Exception]:
        """Find all jobs."""
        try:
            jobs = self._read_jobs()
            return ok(tuple(self._deserialize_job(job_data) for job_data in jobs))
        except Exception as e:
            return err(e)

    def delete(self, job_id: JobId) -> Result[None, JobNotFoundError]:
        """Delete a job."""
        try:
            jobs = self._read_jobs()
            original_len = len(jobs)
            jobs = [j for j in jobs if j["id"] != str(job_id)]

            if len(jobs) == original_len:
                return err(JobNotFoundError(str(job_id)))

            self._write_jobs(jobs)
            return ok(None)
        except Exception:
            return err(JobNotFoundError(str(job_id)))
