"""Pydantic models for API requests and responses."""

from typing import List, Optional
from pydantic import BaseModel


class VodMetaResponse(BaseModel):
    """VOD metadata response."""
    streamer: str
    vodId: str
    title: str
    duration: str
    previewUrl: str


class JobStatusResponse(BaseModel):
    """Job status response."""
    jobId: str
    status: str  # idle, running, done, error
    message: Optional[str] = None
    exitCode: Optional[int] = None
    log: List[str] = []


class RunAudioRequest(BaseModel):
    """Audio extraction request."""
    vodUrl: str
    force: bool = False
    useDemucs: bool = False
    skipAac: bool = False


class RunAudioResponse(BaseModel):
    """Audio extraction response."""
    path: str
    exitCode: int
    log: List[str] = []


class RunSanitizeRequest(BaseModel):
    """Audio sanitization request."""
    vodUrl: str


class RunSanitizeResponse(BaseModel):
    """Audio sanitization response."""
    cleanPath: str
    segmentsPath: str
    exitCode: int
    log: List[str] = []


class RunSrtRequest(BaseModel):
    """SRT transcription request."""
    vodUrl: str


class RunSrtResponse(BaseModel):
    """SRT transcription response."""
    path: str
    lines: int
    excerpt: str
    exitCode: int
    log: List[str] = []


class RunTtsRequest(BaseModel):
    """TTS generation request."""
    vodUrl: str
    text: str
    streamer: str


class RunTtsResponse(BaseModel):
    """TTS generation response."""
    outputPath: str
    exitCode: int
    log: List[str] = []
