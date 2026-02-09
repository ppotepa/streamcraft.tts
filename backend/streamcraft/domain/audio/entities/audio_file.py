"""Audio file entity."""

from dataclasses import dataclass
from pathlib import Path

from streamcraft.domain.audio.value_objects.audio_format import AudioFormat
from streamcraft.domain.audio.value_objects.sample_rate import SampleRate
from streamcraft.domain.shared.branded_types import AudioFileId
from streamcraft.domain.shared.value_objects import Duration


@dataclass(frozen=True, slots=True)
class AudioFile:
    """Audio file entity."""

    id: AudioFileId
    path: Path
    format: AudioFormat
    sample_rate: SampleRate
    duration: Duration
    size_bytes: int
    channels: int = 1

    def __post_init__(self) -> None:
        """Validate audio file."""
        if self.size_bytes < 0:
            raise ValueError("File size cannot be negative")
        if self.channels < 1:
            raise ValueError("Channels must be at least 1")
        if self.channels > 8:
            raise ValueError("Channels cannot exceed 8")

    @property
    def is_mono(self) -> bool:
        """Check if audio is mono."""
        return self.channels == 1

    @property
    def is_stereo(self) -> bool:
        """Check if audio is stereo."""
        return self.channels == 2

    @property
    def megabytes(self) -> float:
        """Get file size in megabytes."""
        return self.size_bytes / (1024 * 1024)
