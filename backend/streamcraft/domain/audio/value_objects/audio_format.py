"""Audio format value object."""

from enum import Enum


class AudioFormat(str, Enum):
    """Audio file format."""

    WAV = "wav"
    AAC = "aac"
    PCM = "pcm"
    MP3 = "mp3"
    FLAC = "flac"

    def __str__(self) -> str:
        """String representation."""
        return self.value

    @property
    def extension(self) -> str:
        """Get file extension."""
        return f".{self.value}"

    @property
    def is_lossless(self) -> bool:
        """Check if format is lossless."""
        return self in (AudioFormat.WAV, AudioFormat.PCM, AudioFormat.FLAC)
