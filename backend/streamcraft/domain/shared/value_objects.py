"""Common value objects used across domains.

Value objects are immutable, validated data structures that represent concepts
without identity. They are compared by value, not by reference.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Final


@dataclass(frozen=True, slots=True)
class Duration:
    """Represents a duration in seconds with validation."""

    seconds: float

    def __post_init__(self) -> None:
        """Validate duration."""
        if self.seconds < 0:
            raise ValueError("Duration cannot be negative")

    @classmethod
    def from_milliseconds(cls, milliseconds: float) -> "Duration":
        """Create duration from milliseconds."""
        return cls(seconds=milliseconds / 1000.0)

    @classmethod
    def from_minutes(cls, minutes: float) -> "Duration":
        """Create duration from minutes."""
        return cls(seconds=minutes * 60.0)

    def to_milliseconds(self) -> float:
        """Convert to milliseconds."""
        return self.seconds * 1000.0

    def to_minutes(self) -> float:
        """Convert to minutes."""
        return self.seconds / 60.0


@dataclass(frozen=True, slots=True)
class Timestamp:
    """Represents a point in time."""

    value: datetime

    @classmethod
    def now(cls) -> "Timestamp":
        """Create timestamp for current time."""
        return cls(value=datetime.now())

    @classmethod
    def from_iso(cls, iso_string: str) -> "Timestamp":
        """Create timestamp from ISO format string."""
        return cls(value=datetime.fromisoformat(iso_string))

    def to_iso(self) -> str:
        """Convert to ISO format string."""
        return self.value.isoformat()


@dataclass(frozen=True, slots=True)
class FilePath:
    """Represents a validated file path."""

    path: str

    def __post_init__(self) -> None:
        """Validate file path."""
        if not self.path:
            raise ValueError("File path cannot be empty")
        if ".." in self.path:
            raise ValueError("File path cannot contain '..'")

    @property
    def extension(self) -> str:
        """Get file extension."""
        return self.path.rsplit(".", 1)[-1] if "." in self.path else ""

    @property
    def name(self) -> str:
        """Get file name without extension."""
        name = self.path.rsplit("/", 1)[-1]
        return name.rsplit(".", 1)[0] if "." in name else name


@dataclass(frozen=True, slots=True)
class AudioQuality:
    """Represents audio quality metrics."""

    sample_rate: int
    bit_depth: int
    channels: int

    QUALITY_16K_MONO: Final = None  # Will be assigned after class definition

    def __post_init__(self) -> None:
        """Validate audio quality parameters."""
        if self.sample_rate <= 0:
            raise ValueError("Sample rate must be positive")
        if self.bit_depth not in (8, 16, 24, 32):
            raise ValueError("Bit depth must be 8, 16, 24, or 32")
        if self.channels <= 0:
            raise ValueError("Channels must be positive")


# Define common quality constants
AudioQuality.QUALITY_16K_MONO = AudioQuality(sample_rate=16000, bit_depth=16, channels=1)
