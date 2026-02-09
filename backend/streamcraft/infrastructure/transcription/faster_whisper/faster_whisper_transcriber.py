"""Faster-Whisper transcriber implementation."""

import uuid
from pathlib import Path

from streamcraft.domain.audio.value_objects.time_range import TimeRange
from streamcraft.domain.shared.branded_types import CueId, TranscriptId, create_cue_id, create_transcript_id
from streamcraft.domain.shared.result import Failure, Result, Success
from streamcraft.domain.transcription.entities.cue import Cue
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.errors.transcription_errors import TranscriptionFailedError
from streamcraft.domain.transcription.ports.transcriber import Transcriber
from streamcraft.domain.transcription.value_objects.confidence_score import ConfidenceScore
from streamcraft.domain.transcription.value_objects.language_code import LanguageCode
from streamcraft.domain.transcription.value_objects.transcript_text import TranscriptText
from streamcraft.domain.transcription.value_objects.whisper_model import WhisperModel


class FasterWhisperTranscriber(Transcriber):
    """Faster-Whisper implementation of transcriber."""

    def __init__(self, device: str = "cpu", compute_type: str = "int8") -> None:
        """Initialize transcriber with device and compute type."""
        self._device = device
        self._compute_type = compute_type
        self._model_cache: dict[WhisperModel, object] = {}

    def transcribe(
        self,
        audio_path: Path,
        language: LanguageCode | None = None,
        model: WhisperModel = WhisperModel.LARGE_V3,
    ) -> Result[Transcript, TranscriptionFailedError]:
        """Transcribe audio file using Faster-Whisper."""
        try:
            from faster_whisper import WhisperModel as FWModel

            # Get or load model
            if model not in self._model_cache:
                self._model_cache[model] = FWModel(
                    str(model), device=self._device, compute_type=self._compute_type
                )

            fw_model = self._model_cache[model]

            # Transcribe
            segments, info = fw_model.transcribe(
                str(audio_path),
                language=language.code if language else None,
                word_timestamps=False,
            )

            # Convert segments to cues
            cues: list[Cue] = []
            for segment in segments:
                cue = Cue(
                    id=create_cue_id(str(uuid.uuid4())),
                    time_range=TimeRange(start=segment.start, end=segment.end),
                    text=TranscriptText.create(segment.text),
                    confidence=ConfidenceScore(value=min(segment.avg_logprob + 1.0, 1.0)),
                )
                cues.append(cue)

            if not cues:
                return Failure(
                    error=TranscriptionFailedError(
                        audio_path=str(audio_path), reason="No segments transcribed"
                    )
                )

            # Detect language if not provided
            detected_language = language or LanguageCode(code=info.language)

            # Create transcript
            transcript = Transcript(
                id=create_transcript_id(str(uuid.uuid4())),
                cues=tuple(cues),
                language=detected_language,
            )

            return Success(value=transcript)

        except ImportError:
            return Failure(
                error=TranscriptionFailedError(
                    audio_path=str(audio_path), reason="faster-whisper not installed"
                )
            )
        except Exception as e:
            return Failure(
                error=TranscriptionFailedError(audio_path=str(audio_path), reason=str(e))
            )
