"""Additional FastAPI routes for jobs."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from streamcraft.application.job.complete_job_step import CompleteJobStepCommand, CompleteJobStepHandler
from streamcraft.application.job.fail_job_step import FailJobStepCommand, FailJobStepHandler
from streamcraft.application.job.get_job_status import GetJobStatusCommand, GetJobStatusHandler
from streamcraft.application.job.list_jobs import ListJobsCommand, ListJobsHandler
from streamcraft.application.job.start_job_step import StartJobStepCommand, StartJobStepHandler
from streamcraft.domain.job.value_objects.step_name import StepName
from streamcraft.infrastructure.web.fastapi.dependencies import (
    get_complete_job_step_handler,
    get_fail_job_step_handler,
    get_get_job_status_handler,
    get_list_jobs_handler,
    get_start_job_step_handler,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


class GetJobStatusResponse(BaseModel):
    """Response model for get job status."""

    job_id: str
    vod_url: str
    status_kind: str
    current_step: str | None
    progress: float | None
    error_message: str | None
    created_at: str
    updated_at: str


@router.get("/{job_id}", response_model=GetJobStatusResponse)
def get_job_status(
    job_id: str,
    handler: Annotated[GetJobStatusHandler, Depends(get_get_job_status_handler)],
) -> GetJobStatusResponse:
    """Get job status by ID."""
    from streamcraft.domain.shared.branded_types import create_job_id

    command = GetJobStatusCommand(job_id=create_job_id(job_id))
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=404, detail="Job not found")

    dto = result.unwrap()

    return GetJobStatusResponse(
        job_id=dto.job_id,
        vod_url=dto.vod_url,
        status_kind=dto.status_kind,
        current_step=dto.current_step,
        progress=dto.progress,
        error_message=dto.error_message,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


class JobSummaryResponse(BaseModel):
    """Response model for job summary."""

    job_id: str
    vod_url: str
    status_kind: str
    created_at: str


class ListJobsResponse(BaseModel):
    """Response model for list jobs."""

    jobs: list[JobSummaryResponse]
    total_count: int


@router.get("", response_model=ListJobsResponse)
def list_jobs(
    handler: Annotated[ListJobsHandler, Depends(get_list_jobs_handler)],
    limit: Annotated[int | None, Query(ge=1, le=100)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ListJobsResponse:
    """List all jobs with pagination."""
    command = ListJobsCommand(limit=limit, offset=offset)
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=500, detail="Failed to list jobs")

    dto = result.unwrap()

    return ListJobsResponse(
        jobs=[
            JobSummaryResponse(
                job_id=job.job_id,
                vod_url=job.vod_url,
                status_kind=job.status_kind,
                created_at=job.created_at,
            )
            for job in dto.jobs
        ],
        total_count=dto.total_count,
    )


class StartJobStepRequest(BaseModel):
    """Request model for starting job step."""

    step_name: str


class StartJobStepResponse(BaseModel):
    """Response model for start job step."""

    job_id: str
    current_step: str
    status_kind: str


@router.post("/{job_id}/steps/start", response_model=StartJobStepResponse)
def start_job_step(
    job_id: str,
    request: StartJobStepRequest,
    handler: Annotated[StartJobStepHandler, Depends(get_start_job_step_handler)],
) -> StartJobStepResponse:
    """Start a job step."""
    from streamcraft.domain.shared.branded_types import create_job_id

    try:
        step_name = StepName(request.step_name)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid step name: {request.step_name}")

    command = StartJobStepCommand(job_id=create_job_id(job_id), step_name=step_name)
    result = handler.execute(command)

    if result.is_failure():
        error = result.unwrap_error()
        raise HTTPException(status_code=400, detail=str(error))

    dto = result.unwrap()

    return StartJobStepResponse(
        job_id=dto.job_id, current_step=dto.current_step, status_kind=dto.status_kind
    )
