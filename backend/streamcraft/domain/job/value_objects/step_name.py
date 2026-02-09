"""Step name value object."""

from enum import Enum


class StepName(str, Enum):
    """Available job steps."""

    FETCH_METADATA = "fetch_metadata"
    DOWNLOAD_VOD = "download_vod"
    EXTRACT_AUDIO = "extract_audio"
    TRANSCRIBE = "transcribe"
    PARSE_SUBTITLES = "parse_subtitles"
    SLICE_SEGMENTS = "slice_segments"
    ANALYZE_QUALITY = "analyze_quality"
    CREATE_DATASET = "create_dataset"
    EXPORT = "export"

    def __str__(self) -> str:
        """String representation."""
        return self.value

    @property
    def display_name(self) -> str:
        """Get human-readable display name."""
        return self.value.replace("_", " ").title()
