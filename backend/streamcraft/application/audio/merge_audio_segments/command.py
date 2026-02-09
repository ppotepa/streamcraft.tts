"""
Merge Audio Segments Use Case - Command
"""

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class MergeAudioSegmentsCommand:
    """Command to merge multiple audio segments into single file."""

    segment_paths: List[str]
    output_path: str
    format: str = "wav"
    normalize: bool = False
