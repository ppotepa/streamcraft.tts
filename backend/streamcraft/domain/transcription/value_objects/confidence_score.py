"""Confidence score value object."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ConfidenceScore:
    """Confidence score for transcription (0.0 to 1.0)."""

    value: float

    def __post_init__(self) -> None:
        """Validate confidence score."""
        if not 0.0 <= self.value <= 1.0:
            raise ValueError("Confidence score must be between 0.0 and 1.0")

    @classmethod
    def high(cls) -> "ConfidenceScore":
        """Create high confidence (0.9)."""
        return cls(value=0.9)

    @classmethod
    def medium(cls) -> "ConfidenceScore":
        """Create medium confidence (0.7)."""
        return cls(value=0.7)

    @classmethod
    def low(cls) -> "ConfidenceScore":
        """Create low confidence (0.5)."""
        return cls(value=0.5)

    def is_high(self, threshold: float = 0.8) -> bool:
        """Check if confidence is high."""
        return self.value >= threshold

    def is_low(self, threshold: float = 0.6) -> bool:
        """Check if confidence is low."""
        return self.value < threshold
