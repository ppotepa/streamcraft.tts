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
    runId: Optional[str] = None
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
    runId: Optional[str] = None
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
    runId: Optional[str] = None


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
    text: Optional[str] = None
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
    runId: Optional[str] = None
    outdir: str = "out"
    datasetOut: str = "dataset"
    stream: bool = False
    speed: Literal["accurate", "balanced", "fast"] = "balanced"
    acceptedOnly: bool = True


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
    runId: Optional[str] = None
    outdir: str = "out"
    datasetOut: str = "dataset"
    text: str
    streamer: str
    stream: bool = False
    sourceMode: Literal["all_streamer", "target_dataset"] = "all_streamer"
    targetDatasetPath: Optional[str] = None
    qualityPreset: Literal["fast", "balanced", "best"] = "balanced"
    acceptedOnly: bool = False
    advancedMode: bool = False

    # advanced reference selection overrides
    targetSeconds: Optional[float] = None
    maxPerRun: Optional[int] = None
    minSpeakerSim: Optional[float] = None
    minClipSec: Optional[float] = None
    maxClipSec: Optional[float] = None
    maxClips: Optional[int] = None
    speakerClipCount: Optional[int] = None

    # advanced generation/runtime controls
    model: Optional[str] = None
    language: Optional[str] = None
    device: Optional[Literal["auto", "cpu", "cuda"]] = None
    cpuThreads: Optional[int] = None
    cudaBenchmark: Optional[bool] = None
    temperature: Optional[float] = None
    topP: Optional[float] = None
    topK: Optional[int] = None
    speed: Optional[float] = None
    repetitionPenalty: Optional[float] = None
    lengthPenalty: Optional[float] = None


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
    runId: Optional[str] = None
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
    stream: bool = False
    minSpeakerSim: float = 0.10
    targetSpeaker: Optional[str] = None


class RunTrainResponse(BaseModel):
    """Voice dataset training response."""
    datasetPath: str
    clipsDir: str
    manifestPath: str
    segmentsPath: str
    exitCode: int
    log: List[str] = []


class RunDiarizationRequest(BaseModel):
    vodUrl: str
    runId: Optional[str] = None
    outdir: str = "out"
    datasetOut: str = "dataset"


class RunDiarizationResponse(BaseModel):
    labelsPath: str
    speakerCount: int
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
    runId: Optional[str] = None
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
    runId: Optional[str] = None
    segmentIndex: int
    outdir: str = "out"
    datasetOut: str = "dataset"


class TranscribeSegmentWord(BaseModel):
    """Individual word in transcription."""
    word: str
    start: float
    end: float
    probability: float


class DatasetRecordResponse(BaseModel):
    """Unified dataset/run record for streamer dataset browser."""
    datasetId: str
    streamer: str
    runId: Optional[str] = None
    status: str
    createdAt: Optional[str] = None
    vodUrl: Optional[str] = None
    vodId: Optional[str] = None
    datasetPath: str
    clipsPath: Optional[str] = None
    clipsCount: int = 0
    manifestPath: Optional[str] = None
    segmentsPath: Optional[str] = None
    latestTtsPath: Optional[str] = None
    hasTrainArtifacts: bool = False
    hasTtsArtifacts: bool = False
    params: dict = {}
    stats: dict = {}


class DatasetListResponse(BaseModel):
    """List of dataset records."""
    items: List[DatasetRecordResponse]
    total: int


class StreamerDatasetSummaryResponse(BaseModel):
    """Summary of dataset availability per streamer."""
    streamer: str
    datasets: int
    runs: int
    latestRunAt: Optional[str] = None
    latestTtsPath: Optional[str] = None


class StreamerDatasetSummaryListResponse(BaseModel):
    """List of streamer dataset summaries."""
    items: List[StreamerDatasetSummaryResponse]
    total: int = 0


class ModelTrainRequest(BaseModel):
    """Model fine-tune request (stub)."""
    vodUrl: str
    runId: Optional[str] = None
    outdir: str = "out"
    datasetOut: str = "dataset"
    modelOut: str = "models"
    baseModel: str = "xtts_v2"
    epochs: int = 0


class ModelTrainResponse(BaseModel):
    """Model fine-tune response (stub)."""
    jobId: str
    checkpointId: str
    status: str
    checkpointPath: str
    metadataPath: str
    log: List[str] = []


class ModelTrainJobResponse(BaseModel):
    id: str
    status: Literal["queued", "running", "failed", "done", "canceled"]
    createdAt: str
    updatedAt: str
    runId: str
    vodUrl: str
    streamer: str
    checkpointId: str
    checkpointPath: str
    metadataPath: str
    datasetManifest: str
    progress: int = 0
    error: Optional[str] = None
    log: List[str] = []


class ModelTrainJobListResponse(BaseModel):
    items: List[ModelTrainJobResponse]
    total: int
    total: int
