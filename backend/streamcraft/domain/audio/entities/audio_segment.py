"""Audio segment entity."""

from dataclasses import dataclass

from streamcraft.domain.audio.value_objects.rms_db import RmsDb
from streamcraft.domain.audio.value_objects.time_range import TimeRange
from streamcraft.domain.shared.branded_types import SegmentId


@dataclass(frozen=True, slots=True)
class AudioSegment:
    """Audio segment entity."""

    id: SegmentId
    time_range: TimeRange
    text: str
    rms_db: RmsDb | None = None
    quality_score: float | None = None  # 0.0 to 1.0

    def __post_init__(self) -> None:
        """Validate segment."""
        if not self.text.strip():
            raise ValueError("Segment text cannot be empty")
        if self.quality_score is not None:
            if not 0.0 <= self.quality_score <= 1.0:
                raise ValueError("Quality score must be between 0.0 and 1.0")

    @property
    def duration_seconds(self) -> float:
        """Get segment duration."""
        return self.time_range.duration

    def is_high_quality(self, threshold: float = 0.7) -> bool:
        """Check if segment is high quality."""
        if self.quality_score is None:
            return False
        return self.quality_score >= threshold

    def with_quality(self, quality_score: float, rms_db: RmsDb) -> "AudioSegment":
        """Create new segment with quality metrics."""
        return AudioSegment(
            id=self.id,
            time_range=self.time_range,
            text=self.text,
            rms_db=rms_db,
            quality_score=quality_score,
        )
