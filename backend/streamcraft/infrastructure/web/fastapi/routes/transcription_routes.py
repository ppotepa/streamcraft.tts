"""
FastAPI routes for Transcription domain
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from streamcraft.application.transcription.filter_transcript_cues import FilterTranscriptCuesHandler
from streamcraft.application.transcription.get_transcript import GetTranscriptHandler
from streamcraft.application.transcription.parse_subtitles import ParseSubtitlesHandler
from streamcraft.application.transcription.transcribe_audio import TranscribeAudioHandler
from streamcraft.domain.shared.result import Failure
from streamcraft.infrastructure.web.fastapi.dependencies import (
    get_transcribe_audio_handler,
    get_get_transcript_handler,
    get_parse_subtitles_handler,
    get_filter_transcript_cues_handler,
)


router = APIRouter(prefix="/transcriptions", tags=["transcriptions"])


# Request models
class TranscribeAudioRequest(BaseModel):
    audio_path: str
    model: str = "base"
    language: Optional[str] = None


class ParseSubtitlesRequest(BaseModel):
    subtitle_path: str
    format: str  # "srt", "vtt", or "auto"
    audio_path: Optional[str] = None


class FilterTranscriptCuesRequest(BaseModel):
    transcription_id: str
    min_confidence: Optional[float] = None
    min_duration_seconds: Optional[float] = None
    max_duration_seconds: Optional[float] = None
    remove_empty_text: bool = True


# Dependency injection placeholders
# NOTE: These are now defined in dependencies.py and imported via Depends


# Routes
@router.post("/transcribe")
async def transcribe_audio(
    request: TranscribeAudioRequest,
    handler: TranscribeAudioHandler = Depends(get_transcribe_audio_handler),
):
    """Transcribe audio file."""
    from streamcraft.application.transcription.transcribe_audio import TranscribeAudioCommand

    command = TranscribeAudioCommand(
        audio_path=request.audio_path,
        model=request.model,
        language=request.language,
    )
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=400, detail=str(result.unwrap_error()))

    return result.unwrap()


@router.get("/{transcription_id}")
async def get_transcript(
    transcription_id: str,
    handler: GetTranscriptHandler = Depends(get_get_transcript_handler),
):
    """Get transcript by ID."""
    from streamcraft.application.transcription.get_transcript import GetTranscriptCommand

    command = GetTranscriptCommand(transcription_id=transcription_id)
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=404, detail=str(result.unwrap_error()))

    return result.unwrap()


@router.post("/parse")
async def parse_subtitles(
    request: ParseSubtitlesRequest,
    handler: ParseSubtitlesHandler = Depends(get_parse_subtitles_handler),
):
    """Parse subtitle file into transcript."""
    from streamcraft.application.transcription.parse_subtitles import ParseSubtitlesCommand

    command = ParseSubtitlesCommand(
        subtitle_path=request.subtitle_path,
        format=request.format,
        audio_path=request.audio_path,
    )
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=400, detail=str(result.unwrap_error()))

    return result.unwrap()


@router.post("/{transcription_id}/filter")
async def filter_transcript_cues(
    transcription_id: str,
    request: FilterTranscriptCuesRequest,
    handler: FilterTranscriptCuesHandler = Depends(get_filter_transcript_cues_handler),
):
    """Filter transcript cues by quality criteria."""
    from streamcraft.application.transcription.filter_transcript_cues import FilterTranscriptCuesCommand

    command = FilterTranscriptCuesCommand(
        transcription_id=transcription_id,
        min_confidence=request.min_confidence,
        min_duration_seconds=request.min_duration_seconds,
        max_duration_seconds=request.max_duration_seconds,
        remove_empty_text=request.remove_empty_text,
    )
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=404, detail=str(result.unwrap_error()))

    return result.unwrap()
