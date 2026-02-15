"""Model training endpoints."""

from fastapi import APIRouter, Query

from streamcraft.api.routes import model_train_handlers as route_impl
from streamcraft.models.api import (
    ModelTrainJobListResponse,
    ModelTrainJobResponse,
    ModelTrainRequest,
    ModelTrainResponse,
)

router = APIRouter()


@router.post("/model/train")
async def run_model_train(request: ModelTrainRequest) -> ModelTrainResponse:
    return await route_impl.run_model_train(request)


@router.get("/model/train/jobs", response_model=ModelTrainJobListResponse)
async def list_model_train_jobs(limit: int = Query(50, ge=1, le=200)) -> ModelTrainJobListResponse:
    return await route_impl.list_model_train_jobs(limit=limit)


@router.get("/model/train/jobs/{job_id}", response_model=ModelTrainJobResponse)
async def get_model_train_job(job_id: str) -> ModelTrainJobResponse:
    return await route_impl.get_model_train_job(job_id)


@router.post("/model/train/jobs/{job_id}/cancel", response_model=ModelTrainJobResponse)
async def cancel_model_train_job(job_id: str) -> ModelTrainJobResponse:
    return await route_impl.cancel_model_train_job(job_id)


@router.post("/model/train/jobs/{job_id}/retry", response_model=ModelTrainJobResponse)
async def retry_model_train_job(job_id: str) -> ModelTrainJobResponse:
    return await route_impl.retry_model_train_job(job_id)
