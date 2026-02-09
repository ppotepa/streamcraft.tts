"""Extract audio use case DTO."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import AudioFileId


@dataclass(frozen=True, slots=True)
class ExtractAudioDto:
    """DTO for extracted audio result."""

    audio_file_id: AudioFileId
    output_path: str
    duration_seconds: float
    size_megabytes: float
    sample_rate_hz: int
    format: str
