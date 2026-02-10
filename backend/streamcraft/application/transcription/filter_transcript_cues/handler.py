"""Filter transcript cues handler."""

from streamcraft.application.transcription.filter_transcript_cues.command import (
    FilterTranscriptCuesCommand,
)
from streamcraft.application.transcription.filter_transcript_cues.dto import (
    FilterTranscriptCuesDto,
)
from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.transcription import TranscriptionNotFoundError, TranscriptionRepository


class FilterTranscriptCuesHandler:
    """Handler for filtering transcript cues."""

    def __init__(self, transcription_repository: TranscriptionRepository) -> None:
        """Initialize handler with dependencies."""
        self._transcription_repository = transcription_repository

    def handle(
        self, command: FilterTranscriptCuesCommand
    ) -> Result[FilterTranscriptCuesDto, TranscriptionNotFoundError]:
        """Filter out low-confidence or problematic cues from transcript."""
        # Find transcription
        find_result = self._transcription_repository.find_by_id(command.transcription_id)
        if isinstance(find_result, Err):
            return find_result

        transcript = find_result.value
        original_cues = transcript.cues()
        original_count = len(original_cues)

        # Apply filters
        filtered_cues = original_cues.copy()

        # Filter by confidence
        if command.min_confidence is not None:
            filtered_cues = [
                cue
                for cue in filtered_cues
                if cue.confidence is not None and cue.confidence >= command.min_confidence
            ]

        # Filter by duration
        if command.min_duration_seconds is not None:
            filtered_cues = [
                cue
                for cue in filtered_cues
                if (cue.end_time - cue.start_time) >= command.min_duration_seconds
            ]

        if command.max_duration_seconds is not None:
            filtered_cues = [
                cue
                for cue in filtered_cues
                if (cue.end_time - cue.start_time) <= command.max_duration_seconds
            ]

        # Remove empty text
        if command.remove_empty_text:
            filtered_cues = [cue for cue in filtered_cues if cue.text.strip()]

        # Update transcript with filtered cues
        transcript.update_cues(filtered_cues)

        # Save updated transcript
        save_result = self._transcription_repository.save(transcript)
        if isinstance(save_result, Err):
            return save_result

        # Build filters_applied dict
        filters_applied: dict[str, str | float | bool] = {}
        if command.min_confidence is not None:
            filters_applied["min_confidence"] = command.min_confidence
        if command.min_duration_seconds is not None:
            filters_applied["min_duration_seconds"] = command.min_duration_seconds
        if command.max_duration_seconds is not None:
            filters_applied["max_duration_seconds"] = command.max_duration_seconds
        if command.remove_empty_text:
            filters_applied["remove_empty_text"] = True

        # Create response DTO
        dto = FilterTranscriptCuesDto(
            transcription_id=transcript.id(),
            original_cue_count=original_count,
            filtered_cue_count=len(filtered_cues),
            removed_cue_count=original_count - len(filtered_cues),
            filters_applied=filters_applied,
        )

        return Ok(dto)
