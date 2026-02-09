"""Filter transcript cues command."""

from dataclasses import dataclass

from streamcraft.domain.transcription import TranscriptionId


@dataclass(frozen=True)
class FilterTranscriptCuesCommand:
    """Command to filter low-confidence or problematic cues."""

    transcription_id: TranscriptionId
    min_confidence: float | None = None
    min_duration_seconds: float | None = None
    max_duration_seconds: float | None = None
    remove_empty_text: bool = True
