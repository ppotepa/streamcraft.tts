"""TTS endpoints."""

from fastapi import APIRouter

from streamcraft.api.routes import tts_handlers as route_impl
from streamcraft.models.api import RunTtsRequest

router = APIRouter()


@router.post("/tts/run")
async def run_tts(request: RunTtsRequest):
    return await route_impl.run_tts(request)
