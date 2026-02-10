"""FastAPI job routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from streamcraft.application.job.create_job.command import CreateJobCommand
from streamcraft.application.job.create_job.dto import CreateJobDto
from streamcraft.application.job.create_job.handler import CreateJobHandler
from streamcraft.domain.shared.result import Failure
from streamcraft.infrastructure.web.fastapi.dependencies import get_create_job_handler


router = APIRouter(prefix="/jobs", tags=["jobs"])


class CreateJobRequest(BaseModel):
    """Request to create a job."""

    vod_url: str


class CreateJobResponse(BaseModel):
    """Response for created job."""

    job_id: str
    vod_id: str
    vod_url: str
    status: str
    created_at: str


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CreateJobResponse)
def create_job(
    request: CreateJobRequest,
    handler: CreateJobHandler = Depends(get_create_job_handler),
) -> CreateJobResponse:
    """Create a new job."""
    command = CreateJobCommand(vod_url=request.vod_url)
    result = handler.execute(command)

    if isinstance(result, Failure):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(result.error),
        )

    dto = result.unwrap()
    return CreateJobResponse(
        job_id=dto.job_id,
        vod_id=dto.vod_id,
        vod_url=dto.vod_url,
        status=dto.status,
        created_at=dto.created_at,
    )
