"""Audio extractor port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.audio.entities.audio_file import AudioFile
from streamcraft.domain.audio.errors.audio_errors import ExtractionFailedError
from streamcraft.domain.shared.result import Result


class AudioExtractor(ABC):
    """Port for extracting audio from video files."""

    @abstractmethod
    def extract(
        self, video_path: Path, output_path: Path, audio_only: bool = True
    ) -> Result[AudioFile, ExtractionFailedError]:
        """Extract audio from video file."""
        ...
