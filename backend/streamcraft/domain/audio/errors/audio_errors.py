"""Audio domain errors."""

from dataclasses import dataclass

from streamcraft.domain.shared.errors import DomainError, ValidationError


@dataclass(frozen=True, slots=True)
class InvalidAudioFormatError(ValidationError):
    """Error when audio format is invalid."""

    def __init__(self, format_value: str, reason: str) -> None:
        """Initialize invalid format error."""
        super().__init__(field="audio_format", value=format_value, message=f"Invalid audio format: {reason}")
        object.__setattr__(self, "code", "INVALID_AUDIO_FORMAT")


@dataclass(frozen=True, slots=True)
class ExtractionFailedError(DomainError):
    """Error when audio extraction fails."""

    source_path: str
    reason: str

    def __init__(self, source_path: str, reason: str) -> None:
        """Initialize extraction failed error."""
        object.__setattr__(self, "source_path", source_path)
        object.__setattr__(self, "reason", reason)
        object.__setattr__(self, "message", f"Failed to extract audio from {source_path}: {reason}")
        object.__setattr__(self, "code", "EXTRACTION_FAILED")


@dataclass(frozen=True, slots=True)
class SegmentInvalidError(ValidationError):
    """Error when audio segment is invalid."""

    def __init__(self, field: str, value: float, reason: str) -> None:
        """Initialize segment invalid error."""
        super().__init__(field=field, value=value, message=f"Invalid segment: {reason}")
        object.__setattr__(self, "code", "SEGMENT_INVALID")
