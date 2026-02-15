"""Audio endpoints."""

from fastapi import APIRouter

from streamcraft.api.routes import audio_handlers as route_impl
from streamcraft.models.api import RunAudioRequest, RunAudioResponse

router = APIRouter()


@router.post("/audio/run")
async def run_audio(request: RunAudioRequest) -> RunAudioResponse:
    return await route_impl.run_audio(request)
