"""Parse subtitles handler."""

from streamcraft.application.transcription.parse_subtitles.command import ParseSubtitlesCommand
from streamcraft.application.transcription.parse_subtitles.dto import (
    ParsedCueDto,
    ParseSubtitlesDto,
)
from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.ports.subtitle_parser import SubtitleParser
from streamcraft.domain.transcription.repository import TranscriptionRepository


class ParseSubtitlesHandler:
    """Handler for parsing subtitle files."""

    def __init__(
        self,
        subtitle_parser: SubtitleParser,
        transcription_repository: TranscriptionRepository,
    ) -> None:
        """Initialize handler with dependencies."""
        self._subtitle_parser = subtitle_parser
        self._transcription_repository = transcription_repository

    def handle(
        self, command: ParseSubtitlesCommand
    ) -> Result[ParseSubtitlesDto, Exception]:
        """Parse subtitle file into transcription."""
        # Parse subtitle file
        parse_result = self._subtitle_parser.parse(
            subtitle_path=command.subtitle_path,
            format=command.format,
        )

        if isinstance(parse_result, Err):
            return parse_result

        cues = parse_result.value

        # Create transcript entity
        transcript = Transcript(
            id=f"transcript_{command.subtitle_path.stem}",
            audio_path=command.audio_path or command.subtitle_path.with_suffix(".wav"),
            cues=cues,
            language=None,
        )

        # Save transcript
        save_result = self._transcription_repository.save(transcript)
        if isinstance(save_result, Err):
            return save_result

        # Calculate total duration
        duration = max((cue.end_time for cue in cues), default=0.0)

        # Convert cues to DTOs
        cue_dtos = [
            ParsedCueDto(
                start_time_seconds=cue.start_time,
                end_time_seconds=cue.end_time,
                text=cue.text,
            )
            for cue in cues
        ]

        # Create response DTO
        dto = ParseSubtitlesDto(
            transcription_id=transcript.id(),
            subtitle_path=str(command.subtitle_path),
            format=command.format,
            cues=cue_dtos,
            total_cues=len(cues),
            duration_seconds=duration,
        )

        return Ok(dto)
