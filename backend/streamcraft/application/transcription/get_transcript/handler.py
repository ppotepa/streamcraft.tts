"""Get transcript handler."""

from streamcraft.application.transcription.get_transcript.command import GetTranscriptCommand
from streamcraft.application.transcription.get_transcript.dto import CueDto, GetTranscriptDto
from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.transcription import TranscriptionNotFoundError
from streamcraft.domain.transcription.repository import TranscriptionRepository


class GetTranscriptHandler:
    """Handler for retrieving a transcription."""

    def __init__(self, transcription_repository: TranscriptionRepository) -> None:
        """Initialize handler with dependencies."""
        self._transcription_repository = transcription_repository

    def handle(
        self, command: GetTranscriptCommand
    ) -> Result[GetTranscriptDto, TranscriptionNotFoundError]:
        """Retrieve transcription by ID."""
        # Find transcription
        find_result = self._transcription_repository.find_by_id(command.transcription_id)
        if isinstance(find_result, Err):
            return find_result

        transcription = find_result.value

        # Convert cues to DTOs
        cue_dtos = [
            CueDto(
                start_time_seconds=cue.start_time,
                end_time_seconds=cue.end_time,
                text=cue.text,
                confidence=cue.confidence,
            )
            for cue in transcription.cues()
        ]

        # Create response DTO
        dto = GetTranscriptDto(
            transcription_id=transcription.id(),
            audio_path=str(transcription.audio_path()),
            cues=cue_dtos,
            total_cues=len(cue_dtos),
            language=transcription.language(),
            created_at=transcription.created_at().isoformat() if transcription.created_at() else "",
        )

        return Ok(dto)
