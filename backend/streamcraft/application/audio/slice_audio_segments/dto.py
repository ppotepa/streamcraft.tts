"""Slice audio segments DTO."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioSegmentFileDto:
    """DTO for a single sliced segment file."""

    segment_id: str
    file_path: Path
    duration_seconds: float


@dataclass(frozen=True)
class SliceAudioSegmentsDto:
    """DTO for slice audio segments response."""

    audio_path: Path
    output_directory: Path
    segments: list[AudioSegmentFileDto]
    total_segments: int
