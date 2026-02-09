"""Transcriber port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.shared.result import Result
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.errors.transcription_errors import TranscriptionFailedError
from streamcraft.domain.transcription.value_objects.language_code import LanguageCode
from streamcraft.domain.transcription.value_objects.whisper_model import WhisperModel


class Transcriber(ABC):
    """Port for transcribing audio to text."""

    @abstractmethod
    def transcribe(
        self,
        audio_path: Path,
        language: LanguageCode | None = None,
        model: WhisperModel = WhisperModel.LARGE_V3,
    ) -> Result[Transcript, TranscriptionFailedError]:
        """Transcribe audio file to transcript with cues."""
        ...
