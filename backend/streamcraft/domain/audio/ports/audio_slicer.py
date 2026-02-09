"""Audio slicer port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.audio.entities.audio_segment import AudioSegment
from streamcraft.domain.audio.value_objects.time_range import TimeRange
from streamcraft.domain.shared.result import Result


class AudioSlicer(ABC):
    """Port for slicing audio files into segments."""

    @abstractmethod
    def slice(
        self, audio_path: Path, time_range: TimeRange, output_path: Path
    ) -> Result[AudioSegment, Exception]:
        """Slice audio file to time range."""
        ...
