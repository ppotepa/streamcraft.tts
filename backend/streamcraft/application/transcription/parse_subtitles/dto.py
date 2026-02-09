"""Parse subtitles DTO."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedCueDto:
    """DTO for a parsed subtitle cue."""

    start_time_seconds: float
    end_time_seconds: float
    text: str


@dataclass(frozen=True)
class ParseSubtitlesDto:
    """DTO for parse subtitles response."""

    transcription_id: str
    subtitle_path: str
    format: str
    cues: list[ParsedCueDto]
    total_cues: int
    duration_seconds: float
