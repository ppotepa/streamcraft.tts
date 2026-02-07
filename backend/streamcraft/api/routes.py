"""API routes for the wizard."""

from fastapi import APIRouter, HTTPException

from streamcraft.models.api import (
    VodMetaResponse,
    RunAudioRequest,
    RunAudioResponse,
    RunSanitizeRequest,
    RunSanitizeResponse,
    RunSrtRequest,
    RunSrtResponse,
    RunTtsRequest,
    RunTtsResponse,
)

router = APIRouter()


@router.post("/vod/check")
async def check_vod(vod_url: str) -> VodMetaResponse:
    """Check VOD and return metadata."""
    # TODO: Implement actual VOD metadata fetching
    return VodMetaResponse(
        streamer="demo",
        vodId="123456",
        title="Demo VOD",
        duration="1:23:45",
        previewUrl="https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.png",
    )


@router.post("/audio/run")
async def run_audio(request: RunAudioRequest) -> RunAudioResponse:
    """Extract audio from VOD."""
    # TODO: Implement actual audio extraction as background job
    return RunAudioResponse(
        path="out/demo/vods/123456/123456_full.wav",
        exitCode=0,
        log=["[i] Extracting audio...", "[OK] Audio extracted"],
    )


@router.post("/sanitize/run")
async def run_sanitize(request: RunSanitizeRequest) -> RunSanitizeResponse:
    """Sanitize audio."""
    # TODO: Implement actual sanitization as background job
    return RunSanitizeResponse(
        cleanPath="out/demo/vods/123456/123456_clean.wav",
        segmentsPath="dataset/demo/segments.json",
        exitCode=0,
        log=["[i] Sanitizing...", "[OK] Sanitized"],
    )


@router.post("/srt/run")
async def run_srt(request: RunSrtRequest) -> RunSrtResponse:
    """Transcribe audio to SRT."""
    # TODO: Implement actual transcription as background job
    return RunSrtResponse(
        path="out/demo/vods/123456/123456.srt",
        lines=100,
        excerpt="1\n00:00:00,000 --> 00:00:05,000\nHello world\n\n2\n00:00:05,000 --> 00:00:10,000\nThis is a test",
        exitCode=0,
        log=["[i] Transcribing...", "[OK] Transcribed 100 segments"],
    )


@router.post("/tts/run")
async def run_tts(request: RunTtsRequest) -> RunTtsResponse:
    """Generate TTS output."""
    # TODO: Implement actual TTS generation as background job
    return RunTtsResponse(
        outputPath="output/demo/tts/output.wav",
        exitCode=0,
        log=["[i] Generating...", "[OK] Generated"],
    )
