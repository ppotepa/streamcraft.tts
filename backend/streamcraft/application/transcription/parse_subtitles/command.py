"""Parse subtitles command."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ParseSubtitlesCommand:
    """Command to parse subtitle file into transcription."""

    subtitle_path: Path
    format: str  # "srt" | "vtt" | "auto"
    audio_path: Path | None = None
