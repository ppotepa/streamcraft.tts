"""Transcript entity."""

from dataclasses import dataclass
from typing import Sequence

from streamcraft.domain.shared.branded_types import TranscriptId
from streamcraft.domain.transcription.entities.cue import Cue
from streamcraft.domain.transcription.value_objects.language_code import LanguageCode


@dataclass(frozen=True, slots=True)
class Transcript:
    """Complete transcript with cues."""

    id: TranscriptId
    cues: Sequence[Cue]
    language: LanguageCode

    def __post_init__(self) -> None:
        """Validate transcript."""
        if not self.cues:
            raise ValueError("Transcript must have at least one cue")

    @property
    def total_duration(self) -> float:
        """Get total transcript duration."""
        if not self.cues:
            return 0.0
        return self.cues[-1].time_range.end

    @property
    def word_count(self) -> int:
        """Get total word count."""
        return sum(cue.word_count for cue in self.cues)

    @property
    def cue_count(self) -> int:
        """Get number of cues."""
        return len(self.cues)

    def get_cues_in_range(self, start: float, end: float) -> Sequence[Cue]:
        """Get cues within time range."""
        from streamcraft.domain.audio.value_objects.time_range import TimeRange

        query_range = TimeRange(start=start, end=end)
        return tuple(cue for cue in self.cues if cue.time_range.overlaps(query_range))

    def filter_low_confidence(self, threshold: float = 0.8) -> "Transcript":
        """Create new transcript with only high-confidence cues."""
        filtered_cues = tuple(cue for cue in self.cues if cue.is_reliable(threshold))
        return Transcript(id=self.id, cues=filtered_cues, language=self.language)
