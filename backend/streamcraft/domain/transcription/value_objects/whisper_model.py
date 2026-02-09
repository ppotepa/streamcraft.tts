"""Whisper model name value object."""

from enum import Enum


class WhisperModel(str, Enum):
    """Whisper model variants."""

    TINY = "tiny"
    BASE = "base"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    LARGE_V2 = "large-v2"
    LARGE_V3 = "large-v3"

    def __str__(self) -> str:
        """String representation."""
        return self.value

    @property
    def size_mb(self) -> int:
        """Approximate model size in MB."""
        sizes = {
            WhisperModel.TINY: 39,
            WhisperModel.BASE: 74,
            WhisperModel.SMALL: 244,
            WhisperModel.MEDIUM: 769,
            WhisperModel.LARGE: 1550,
            WhisperModel.LARGE_V2: 1550,
            WhisperModel.LARGE_V3: 1550,
        }
        return sizes.get(self, 0)

    @property
    def is_large(self) -> bool:
        """Check if this is a large model."""
        return self in (WhisperModel.LARGE, WhisperModel.LARGE_V2, WhisperModel.LARGE_V3)
