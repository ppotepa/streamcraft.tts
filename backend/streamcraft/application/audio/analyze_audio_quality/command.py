"""Analyze audio quality use case command."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class AnalyzeAudioQualityCommand:
    """Command to analyze audio quality."""

    audio_path: Path
