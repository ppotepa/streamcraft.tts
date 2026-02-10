"""Audio merger port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.audio.entities.audio_file import AudioFile
from streamcraft.domain.shared.result import Result


class AudioMerger(ABC):
    """Port for merging multiple audio segments."""

    @abstractmethod
    async def merge(
        self,
        segment_paths: list[Path],
        output_path: Path,
        format: str = "wav",
        normalize: bool = False,
    ) -> Result[AudioFile, Exception]:
        """Merge audio segments into a single file."""
        ...
