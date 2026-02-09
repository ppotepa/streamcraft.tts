"""FastAPI routes for audio operations."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from streamcraft.application.audio.analyze_audio_quality import (
    AnalyzeAudioQualityCommand,
    AnalyzeAudioQualityHandler,
)
from streamcraft.application.audio.extract_audio import ExtractAudioCommand, ExtractAudioHandler
from streamcraft.infrastructure.web.fastapi.dependencies import (
    get_analyze_audio_quality_handler,
    get_extract_audio_handler,
)

router = APIRouter(prefix="/audio", tags=["audio"])


class ExtractAudioRequest(BaseModel):
    """Request model for extracting audio."""

    video_path: str
    output_path: str
    audio_only: bool = True


class ExtractAudioResponse(BaseModel):
    """Response model for extracted audio."""

    audio_file_id: str
    output_path: str
    duration_seconds: float
    size_megabytes: float
    sample_rate_hz: int
    format: str


@router.post("/extract", response_model=ExtractAudioResponse)
def extract_audio(
    request: ExtractAudioRequest,
    handler: Annotated[ExtractAudioHandler, Depends(get_extract_audio_handler)],
) -> ExtractAudioResponse:
    """Extract audio from video file."""
    from pathlib import Path

    command = ExtractAudioCommand(
        video_path=Path(request.video_path),
        output_path=Path(request.output_path),
        audio_only=request.audio_only,
    )
    result = handler.execute(command)

    if result.is_failure():
        error = result.unwrap_error()
        raise HTTPException(status_code=500, detail=str(error))

    dto = result.unwrap()

    return ExtractAudioResponse(
        audio_file_id=dto.audio_file_id,
        output_path=dto.output_path,
        duration_seconds=dto.duration_seconds,
        size_megabytes=dto.size_megabytes,
        sample_rate_hz=dto.sample_rate_hz,
        format=dto.format,
    )


class AnalyzeAudioQualityRequest(BaseModel):
    """Request model for analyzing audio quality."""

    audio_path: str


class AnalyzeAudioQualityResponse(BaseModel):
    """Response model for audio quality analysis."""

    audio_path: str
    rms_db: float
    quality_score: float
    is_silence: bool
    is_clipping: bool


@router.post("/analyze", response_model=AnalyzeAudioQualityResponse)
def analyze_audio_quality(
    request: AnalyzeAudioQualityRequest,
    handler: Annotated[AnalyzeAudioQualityHandler, Depends(get_analyze_audio_quality_handler)],
) -> AnalyzeAudioQualityResponse:
    """Analyze audio quality metrics."""
    from pathlib import Path

    command = AnalyzeAudioQualityCommand(audio_path=Path(request.audio_path))
    result = handler.execute(command)

    if result.is_failure():
        error = result.unwrap_error()
        raise HTTPException(status_code=500, detail=str(error))

    dto = result.unwrap()

    return AnalyzeAudioQualityResponse(
        audio_path=dto.audio_path,
        rms_db=dto.rms_db,
        quality_score=dto.quality_score,
        is_silence=dto.is_silence,
        is_clipping=dto.is_clipping,
    )
