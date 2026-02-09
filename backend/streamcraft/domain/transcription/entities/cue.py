"""Cue entity (subtitle/transcript cue)."""

from dataclasses import dataclass

from streamcraft.domain.audio.value_objects.time_range import TimeRange
from streamcraft.domain.shared.branded_types import CueId
from streamcraft.domain.transcription.value_objects.confidence_score import ConfidenceScore
from streamcraft.domain.transcription.value_objects.transcript_text import TranscriptText


@dataclass(frozen=True, slots=True)
class Cue:
    """Subtitle or transcript cue with timing."""

    id: CueId
    time_range: TimeRange
    text: TranscriptText
    confidence: ConfidenceScore | None = None

    @property
    def duration_seconds(self) -> float:
        """Get cue duration."""
        return self.time_range.duration

    @property
    def word_count(self) -> int:
        """Get word count."""
        return self.text.word_count

    def is_reliable(self, threshold: float = 0.8) -> bool:
        """Check if cue is reliable based on confidence."""
        if self.confidence is None:
            return True  # No confidence info = assume reliable
        return self.confidence.is_high(threshold)
