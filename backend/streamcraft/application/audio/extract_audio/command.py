"""Extract audio use case command."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class ExtractAudioCommand:
    """Command to extract audio from video."""

    video_path: Path
    output_path: Path
    audio_only: bool = True
