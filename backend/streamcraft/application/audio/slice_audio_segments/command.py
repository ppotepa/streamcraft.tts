"""Slice audio segments command."""

from dataclasses import dataclass
from pathlib import Path

from streamcraft.domain.audio.value_objects.audio_segment import AudioSegment


@dataclass(frozen=True)
class SliceAudioSegmentsCommand:
    """Command to slice audio file into segments."""

    audio_path: Path
    segments: list[AudioSegment]
    output_directory: Path
