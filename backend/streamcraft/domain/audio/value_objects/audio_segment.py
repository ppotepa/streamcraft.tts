"""Audio segment value object."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AudioSegment:
    """Represents a segment of audio with timing information."""

    segment_id: str
    start_time_seconds: float
    end_time_seconds: float
    text: str | None = None

    def duration_seconds(self) -> float:
        """Calculate segment duration."""
        return self.end_time_seconds - self.start_time_seconds

    def __post_init__(self) -> None:
        """Validate segment."""
        if self.start_time_seconds < 0:
            raise ValueError("Start time cannot be negative")
        if self.end_time_seconds < 0:
            raise ValueError("End time cannot be negative")
        if self.start_time_seconds >= self.end_time_seconds:
            raise ValueError("Start time must be before end time")
