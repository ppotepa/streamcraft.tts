"""ASR endpoints."""

from streamcraft.models.api import RunSrtRequest, RunSrtResponse, TranscribeSegmentRequest
from fastapi import APIRouter

from streamcraft.api.routes import asr_handlers as route_impl

router = APIRouter()


@router.post("/srt/run")
async def run_srt(request: RunSrtRequest) -> RunSrtResponse:
    return await route_impl.run_srt(request)


@router.post("/srt/transcribe-segment")
async def transcribe_segment(request: TranscribeSegmentRequest):
    return await route_impl.transcribe_segment(request)
