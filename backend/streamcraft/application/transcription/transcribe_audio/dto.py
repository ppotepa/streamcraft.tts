"""Transcribe audio use case DTO."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import TranscriptId


@dataclass(frozen=True, slots=True)
class TranscribeAudioDto:
    """DTO for transcription result."""

    transcript_id: TranscriptId
    cue_count: int
    total_duration: float
    word_count: int
    language_code: str
