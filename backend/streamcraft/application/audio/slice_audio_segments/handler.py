"""Slice audio segments handler."""

from streamcraft.application.audio.slice_audio_segments.command import SliceAudioSegmentsCommand
from streamcraft.application.audio.slice_audio_segments.dto import (
    AudioSegmentFileDto,
    SliceAudioSegmentsDto,
)
from streamcraft.domain.audio.ports import AudioSlicer
from streamcraft.domain.audio.ports.audio_slicer import AudioSlicingError
from streamcraft.domain.common.result import Err, Ok, Result


class SliceAudioSegmentsHandler:
    """Handler for slicing audio into segments."""

    def __init__(self, audio_slicer: AudioSlicer) -> None:
        """Initialize handler with dependencies."""
        self._audio_slicer = audio_slicer

    def handle(
        self, command: SliceAudioSegmentsCommand
    ) -> Result[SliceAudioSegmentsDto, AudioSlicingError]:
        """Slice audio file into multiple segment files."""
        # Ensure output directory exists
        command.output_directory.mkdir(parents=True, exist_ok=True)

        # Slice the audio
        slice_result = self._audio_slicer.slice_audio(
            audio_path=command.audio_path,
            segments=command.segments,
            output_directory=command.output_directory,
        )

        if isinstance(slice_result, Err):
            return slice_result

        segment_paths = slice_result.value

        # Create DTOs for each segment file
        segment_dtos = [
            AudioSegmentFileDto(
                segment_id=segment.segment_id,
                file_path=segment_path,
                duration_seconds=segment.duration_seconds(),
            )
            for segment, segment_path in zip(command.segments, segment_paths)
        ]

        # Create response DTO
        dto = SliceAudioSegmentsDto(
            audio_path=command.audio_path,
            output_directory=command.output_directory,
            segments=segment_dtos,
            total_segments=len(segment_dtos),
        )

        return Ok(dto)
