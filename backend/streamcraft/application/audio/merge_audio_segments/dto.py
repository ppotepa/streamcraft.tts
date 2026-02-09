"""
Merge Audio Segments Use Case - DTO
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class MergeAudioSegmentsDto:
    """DTO for merged audio segments result."""

    output_path: str
    total_segments: int
    total_duration_seconds: float
    format: str
    file_size_bytes: int
