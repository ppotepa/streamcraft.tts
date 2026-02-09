"""Time range value object."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TimeRange:
    """Represents a time range with start and end."""

    start: float  # seconds
    end: float  # seconds

    def __post_init__(self) -> None:
        """Validate time range."""
        if self.start < 0:
            raise ValueError("Start time cannot be negative")
        if self.end < 0:
            raise ValueError("End time cannot be negative")
        if self.start >= self.end:
            raise ValueError("Start time must be before end time")

    @property
    def duration(self) -> float:
        """Get duration in seconds."""
        return self.end - self.start

    def contains(self, time: float) -> bool:
        """Check if time is within range."""
        return self.start <= time <= self.end

    def overlaps(self, other: "TimeRange") -> bool:
        """Check if this range overlaps with another."""
        return self.start < other.end and self.end > other.start
