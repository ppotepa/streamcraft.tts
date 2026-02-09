"""Audio domain errors."""

from streamcraft.domain.audio.errors.audio_errors import (
    ExtractionFailedError,
    InvalidAudioFormatError,
    SegmentInvalidError,
)

__all__ = [
    "ExtractionFailedError",
    "InvalidAudioFormatError",
    "SegmentInvalidError",
]
