"""Transcribe audio use case handler."""

from streamcraft.application.shared.use_case import UseCase
from streamcraft.application.transcription.transcribe_audio.command import TranscribeAudioCommand
from streamcraft.application.transcription.transcribe_audio.dto import TranscribeAudioDto
from streamcraft.domain.shared.result import Result
from streamcraft.domain.transcription.errors.transcription_errors import TranscriptionFailedError
from streamcraft.domain.transcription.ports.transcriber import Transcriber


class TranscribeAudioHandler(
    UseCase[TranscribeAudioCommand, TranscribeAudioDto, TranscriptionFailedError]
):
    """Use case handler for transcribing audio."""

    def __init__(self, transcriber: Transcriber) -> None:
        """Initialize handler with transcriber."""
        self._transcriber = transcriber

    def execute(
        self, request: TranscribeAudioCommand
    ) -> Result[TranscribeAudioDto, TranscriptionFailedError]:
        """Execute transcription use case."""
        # Transcribe audio
        result = self._transcriber.transcribe(
            audio_path=request.audio_path, language=request.language, model=request.model
        )

        if result.is_failure():
            return result

        transcript = result.unwrap()

        # Convert to DTO
        dto = TranscribeAudioDto(
            transcript_id=transcript.id,
            cue_count=transcript.cue_count,
            total_duration=transcript.total_duration,
            word_count=transcript.word_count,
            language_code=transcript.language.code,
        )

        from streamcraft.domain.shared.result import Success

        return Success(value=dto)
