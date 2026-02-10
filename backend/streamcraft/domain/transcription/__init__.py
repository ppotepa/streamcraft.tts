"""Transcription domain."""

from streamcraft.domain.shared.branded_types import TranscriptId
from streamcraft.domain.transcription.entities import Cue, Transcript
from streamcraft.domain.transcription.errors import InvalidSubtitleFormatError, TranscriptionFailedError, TranscriptionNotFoundError
from streamcraft.domain.transcription.ports import SubtitleParser, Transcriber, TranscriptionRepository
from streamcraft.domain.transcription.value_objects import (
    ConfidenceScore,
    LanguageCode,
    TranscriptText,
    WhisperModel,
)

__all__ = [
    "Cue",
    "Transcript",
    "TranscriptId",
    "InvalidSubtitleFormatError",
    "TranscriptionFailedError",
    "TranscriptionNotFoundError",
    "SubtitleParser",
    "Transcriber",
    "TranscriptionRepository",
    "ConfidenceScore",
    "LanguageCode",
    "TranscriptText",
    "WhisperModel",
]
