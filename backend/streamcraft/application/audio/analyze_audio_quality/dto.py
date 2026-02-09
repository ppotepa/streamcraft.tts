"""Analyze audio quality use case DTO."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AnalyzeAudioQualityDto:
    """DTO for audio quality analysis result."""

    audio_path: str
    rms_db: float
    quality_score: float
    is_silence: bool
    is_clipping: bool
