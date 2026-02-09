"""Subtitle parser port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.shared.result import Result
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.errors.transcription_errors import InvalidSubtitleFormatError


class SubtitleParser(ABC):
    """Port for parsing subtitle files."""

    @abstractmethod
    def parse(self, subtitle_path: Path) -> Result[Transcript, InvalidSubtitleFormatError]:
        """Parse subtitle file to transcript."""
        ...
