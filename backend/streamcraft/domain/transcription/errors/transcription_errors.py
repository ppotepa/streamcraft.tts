"""Transcription domain errors."""

from dataclasses import dataclass

from streamcraft.domain.shared.errors import DomainError, ValidationError


@dataclass(frozen=True, slots=True)
class TranscriptionFailedError(DomainError):
    """Error when transcription fails."""

    audio_path: str
    reason: str

    def __init__(self, audio_path: str, reason: str) -> None:
        """Initialize transcription failed error."""
        object.__setattr__(self, "audio_path", audio_path)
        object.__setattr__(self, "reason", reason)
        object.__setattr__(self, "message", f"Failed to transcribe {audio_path}: {reason}")
        object.__setattr__(self, "code", "TRANSCRIPTION_FAILED")


@dataclass(frozen=True, slots=True)
class InvalidSubtitleFormatError(ValidationError):
    """Error when subtitle format is invalid."""

    def __init__(self, format_value: str, reason: str) -> None:
        """Initialize invalid subtitle format error."""
        super().__init__(
            field="subtitle_format", value=format_value, message=f"Invalid subtitle format: {reason}"
        )
        object.__setattr__(self, "code", "INVALID_SUBTITLE_FORMAT")
