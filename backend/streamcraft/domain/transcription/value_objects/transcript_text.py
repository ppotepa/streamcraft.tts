"""Transcript text value object."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TranscriptText:
    """Validated transcript text."""

    value: str

    def __post_init__(self) -> None:
        """Validate transcript text."""
        if not self.value.strip():
            raise ValueError("Transcript text cannot be empty")

    @classmethod
    def create(cls, text: str) -> "TranscriptText":
        """Create with normalization."""
        normalized = " ".join(text.split())  # Normalize whitespace
        return cls(value=normalized)

    @property
    def word_count(self) -> int:
        """Get word count."""
        return len(self.value.split())

    @property
    def character_count(self) -> int:
        """Get character count."""
        return len(self.value)
