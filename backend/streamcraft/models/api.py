"""Pydantic models for API requests and responses."""

from typing import List, Literal, Optional
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
    outdir: str = "out"
    datasetOut: str = "dataset"
    force: bool = False
    useDemucs: bool = False
    skipAac: bool = False
    authToken: Optional[str] = None
    vodQuality: Optional[str] = None  # e.g., audio_only, source, 720p


class RunAudioResponse(BaseModel):
    """Audio extraction response."""
    path: str
    exitCode: int
    log: List[str] = []


class SegmentPreview(BaseModel):
    start: float
    end: float
    duration: float
    rmsDb: float


class RunSanitizeRequest(BaseModel):
    """Audio sanitization request."""
    vodUrl: str
    outdir: str = "out"
    datasetOut: str = "dataset"
    silenceThresholdDb: float = -45.0
    minSegmentMs: int = 800
    mergeGapMs: int = 300
    targetPeakDb: float = -1.0
    fadeMs: int = 20


class RunSanitizeResponse(BaseModel):
    """Audio sanitization response."""
    cleanPath: str
    segmentsPath: str
    segments: int
    cleanDuration: float
    previewSegments: List[SegmentPreview] = []
    previewPath: str
    previewSampleRate: int
    exitCode: int
    log: List[str] = []


class SegmentReviewVote(BaseModel):
    index: int
    decision: Literal["accept", "reject"]
    segment: SegmentPreview


class SaveSegmentReviewRequest(BaseModel):
    vodUrl: str
    outdir: str = "out"
    datasetOut: str = "dataset"
    totalSegments: int
    reviewIndex: int
    votes: List[SegmentReviewVote] = []


class SaveSegmentReviewResponse(BaseModel):
    reviewPath: str
    totalSegments: int
    reviewIndex: int
    accepted: int
    rejected: int
    updatedAt: str
    votes: List[SegmentReviewVote] = []


class GetSegmentReviewResponse(BaseModel):
    reviewPath: Optional[str] = None
    totalSegments: int
    reviewIndex: int
    accepted: int
    rejected: int
    updatedAt: Optional[str] = None
    votes: List[SegmentReviewVote] = []


class ExportClipsRequest(BaseModel):
    vodUrl: str
    outdir: str = "out"
    datasetOut: str = "dataset"


class ExportClipItem(BaseModel):
    index: int
    start: float
    end: float
    duration: float
    path: str


class ExportClipsResponse(BaseModel):
    clipsDir: str
    sampleRate: int
    count: int
    items: List[ExportClipItem]


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
    outdir: str = "out"
    datasetOut: str = "dataset"
    text: str
    streamer: str


class RunTtsResponse(BaseModel):
    """TTS generation response."""
    outputPath: str
    outdir: str = "out"
    datasetOut: str = "dataset"
    exitCode: int
    log: List[str] = []


class JobSteps(BaseModel):
    """Job step completion status."""
    vod: bool = False
    audio: bool = False
    sanitize: bool = False
    srt: bool = False
    tts: bool = False


class JobOutputs(BaseModel):
    """Job output paths."""
    audioPath: Optional[str] = None
    sanitizePath: Optional[str] = None
    srtPath: Optional[str] = None
    ttsPath: Optional[str] = None


class JobResponse(BaseModel):
    """Job model."""
    id: str
    vodUrl: str
    streamer: str
    title: str
    createdAt: str
    updatedAt: str
    steps: JobSteps
    outputs: Optional[JobOutputs] = None


class UpdateJobRequest(BaseModel):
    """Update job request."""
    steps: Optional[JobSteps] = None
    outputs: Optional[JobOutputs] = None
