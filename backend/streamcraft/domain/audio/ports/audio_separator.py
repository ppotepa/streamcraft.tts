"""Audio separator port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.audio.entities.audio_file import AudioFile
from streamcraft.domain.shared.result import Result


class AudioSeparator(ABC):
    """Port for separating audio into different stems (vocals, instrumental, etc.)."""

    @abstractmethod
    async def separate(
        self,
        audio_path: str,
        output_dir: str,
        stems: list[str] | None = None,
    ) -> Result[dict[str, AudioFile], Exception]:
        """Separate audio into different stems.
        
        Args:
            audio_path: Path to input audio file
            output_dir: Directory to save separated stems
            stems: Optional list of specific stems to extract (e.g., ['vocals', 'drums'])
        
        Returns:
            Result containing dict mapping stem names to AudioFile objects
        """
        ...
