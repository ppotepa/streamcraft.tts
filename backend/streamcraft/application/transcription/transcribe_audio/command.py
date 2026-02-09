"""Transcribe audio use case command."""

from dataclasses import dataclass
from pathlib import Path

from streamcraft.domain.transcription.value_objects.language_code import LanguageCode
from streamcraft.domain.transcription.value_objects.whisper_model import WhisperModel


@dataclass(frozen=True, slots=True)
class TranscribeAudioCommand:
    """Command to transcribe audio file."""

    audio_path: Path
    language: LanguageCode | None = None
    model: WhisperModel = WhisperModel.LARGE_V3
