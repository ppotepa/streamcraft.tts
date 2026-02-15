"""Diarization endpoints."""

from fastapi import APIRouter

from streamcraft.api.routes import diarization_handlers as route_impl
from streamcraft.models.api import RunDiarizationRequest, RunDiarizationResponse

router = APIRouter()


@router.post("/diarization/run")
async def run_diarization(request: RunDiarizationRequest) -> RunDiarizationResponse:
    return await route_impl.run_diarization(request)
