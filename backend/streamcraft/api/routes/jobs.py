"""Job endpoints."""

from fastapi import APIRouter

from streamcraft.api.routes import jobs_handlers as route_impl
from streamcraft.models.api import CreateJobRequest, JobResponse, UpdateJobRequest

router = APIRouter()


@router.post("/jobs")
async def create_job(request: CreateJobRequest) -> JobResponse:
    return await route_impl.create_job(request)


@router.get("/jobs")
async def get_jobs() -> list[JobResponse]:
    return await route_impl.get_jobs()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> JobResponse:
    return await route_impl.get_job(job_id)


@router.put("/jobs/{job_id}")
async def update_job(job_id: str, request: UpdateJobRequest) -> JobResponse:
    return await route_impl.update_job(job_id, request)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> dict:
    return await route_impl.delete_job(job_id)


@router.delete("/jobs/{job_id}/purge")
async def purge_job(job_id: str) -> dict:
    return await route_impl.purge_job(job_id)
