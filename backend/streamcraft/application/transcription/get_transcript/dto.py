"""Get transcript DTO."""

from dataclasses import dataclass

from streamcraft.domain.transcription import Cue


@dataclass(frozen=True)
class CueDto:
    """DTO for a single transcription cue."""

    start_time_seconds: float
    end_time_seconds: float
    text: str
    confidence: float | None


@dataclass(frozen=True)
class GetTranscriptDto:
    """DTO for get transcript response."""

    transcription_id: str
    audio_path: str
    cues: list[CueDto]
    total_cues: int
    language: str | None
    created_at: str
