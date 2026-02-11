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
    platform: Literal["twitch", "youtube"] = "twitch"


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
    rmsDb: Optional[float] = None
    quality: Optional[int] = None
    speechRatio: Optional[float] = None
    snrDb: Optional[float] = None
    clipRatio: Optional[float] = None
    sfxScore: Optional[float] = None
    speakerSim: Optional[float] = None
    kept: Optional[bool] = None
    labels: List[str] = []
    rejectReason: List[str] = []


class RunSanitizeRequest(BaseModel):
    """Audio sanitization request."""
    vodUrl: str
    jobId: Optional[str] = None
    runId: Optional[str] = None  # Optional run identifier for versioning
    outdir: str = "out"
    datasetOut: str = "dataset"
    auto: bool = True
    voiceSample: bool = False
    voiceSampleCount: int = 5
    voiceSampleMinDuration: float = 2.0
    voiceSampleMaxDuration: float = 6.0
    voiceSampleMinRmsDb: float = -35.0
    manualSamples: Optional[List[dict]] = None

    # legacy fields (ignored in v2 but accepted for compatibility)
    silenceThresholdDb: Optional[float] = None
    minSegmentMs: Optional[int] = None
    mergeGapMs: Optional[int] = None
    targetPeakDb: Optional[float] = None


    # v2 controls
    mode: Literal["auto", "voice"] = "auto"
    preset: Literal["strict", "balanced", "lenient"] = "balanced"
    strictness: float = 0.5
    extractVocals: bool = False  # UVR AI vocal isolation preprocessing
    preview: bool = False
    previewStart: float = 0.0
    previewDuration: float = 90.0
    preservePauses: bool = True
    reduceSfx: bool = True
    targetLufs: float = -18.0
    truePeakLimitDb: float = -1.0
    fadeMs: int = 12
    stream: bool = False


class RunSanitizeResponse(BaseModel):
    """Audio sanitization response."""
    cleanPath: str
    segmentsPath: str
    segments: int
    cleanDuration: float
    previewSegments: List[SegmentPreview] = []
    previewPath: str
    previewSampleRate: int
    appliedSettings: dict
    voiceSamples: List[dict] = []
    exitCode: int
    log: List[str] = []


class SegmentReviewVote(BaseModel):
    index: int
    decision: Literal["accept", "reject"]
    segment: SegmentPreview
    note: Optional[str] = None


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


class SegmentManifestItem(BaseModel):
    index: int
    start: float
    end: float
    duration: float
    cleanStart: Optional[float] = None
    cleanEnd: Optional[float] = None
    kept: Optional[bool] = None
    quality: Optional[int] = None
    speechRatio: Optional[float] = None
    snrDb: Optional[float] = None
    clipRatio: Optional[float] = None
    sfxScore: Optional[float] = None
    speakerSim: Optional[float] = None
    labels: List[str] = []
    rejectReason: List[str] = []


class SegmentManifestResponse(BaseModel):
    sampleRate: int
    cleanPath: Optional[str] = None
    originalPath: Optional[str] = None
    segments: List[SegmentManifestItem]
    total: Optional[int] = None
    offset: Optional[int] = None
    limit: Optional[int] = None
    hasMore: Optional[bool] = None


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
    stream: bool = False


class RunTtsResponse(BaseModel):
    """TTS generation response."""
    outputPath: str
    outdir: str = "out"
    datasetOut: str = "dataset"
    exitCode: int
    log: List[str] = []


class RunTrainRequest(BaseModel):
    """Voice dataset training request."""
    vodUrl: str
    outdir: str = "out"
    datasetOut: str = "dataset"
    minSpeechMs: int = 1200
    maxClipSec: int = 12
    padMs: int = 150
    mergeGapMs: int = 300
    clipAac: bool = True
    clipAacBitrate: int = 256
    threads: int = 4
    force: bool = True


class RunTrainResponse(BaseModel):
    """Voice dataset training response."""
    datasetPath: str
    clipsDir: str
    manifestPath: str
    segmentsPath: str
    exitCode: int
    log: List[str] = []


class JobSteps(BaseModel):
    """Job step completion status."""
    vod: bool = False
    audio: bool = False
    sanitize: bool = False
    srt: bool = False
    train: bool = False
    tts: bool = False


class JobOutputs(BaseModel):
    """Job output paths."""
    audioPath: Optional[str] = None
    sanitizePath: Optional[str] = None
    srtPath: Optional[str] = None
    datasetPath: Optional[str] = None
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


class CreateJobRequest(BaseModel):
    """Create job request (legacy wizard)."""
    vodUrl: str
    streamer: Optional[str] = None
    title: Optional[str] = None


class UpdateJobRequest(BaseModel):
    """Update job request."""
    steps: Optional[JobSteps] = None
    outputs: Optional[JobOutputs] = None


class TranscribeSegmentRequest(BaseModel):
    """Request to transcribe a single audio segment."""
    vodUrl: str
    segmentIndex: int
    outdir: str = "out"
    datasetOut: str = "dataset"


class TranscribeSegmentWord(BaseModel):
    """Individual word in transcription."""
    word: str
    start: float
    end: float
    probability: float
