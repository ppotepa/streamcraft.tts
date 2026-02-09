"""Audio quality analyzer port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.audio.value_objects.rms_db import RmsDb
from streamcraft.domain.shared.result import Result


class AudioQualityAnalyzer(ABC):
    """Port for analyzing audio quality metrics."""

    @abstractmethod
    def analyze_rms(self, audio_path: Path) -> Result[RmsDb, Exception]:
        """Analyze RMS level of audio file."""
        ...

    @abstractmethod
    def calculate_quality_score(self, audio_path: Path) -> Result[float, Exception]:
        """Calculate overall quality score (0.0 to 1.0)."""
        ...
