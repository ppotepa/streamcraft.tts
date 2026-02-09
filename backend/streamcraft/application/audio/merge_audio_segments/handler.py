"""
Merge Audio Segments Use Case - Handler
"""

from ....domain.audio.ports import AudioMerger
from ....domain.shared.result import Result, Err, Ok
from .command import MergeAudioSegmentsCommand
from .dto import MergeAudioSegmentsDto


class MergeAudioSegmentsHandler:
    """Handler for merging audio segments."""

    def __init__(self, audio_merger: AudioMerger) -> None:
        self._audio_merger = audio_merger

    async def execute(
        self, command: MergeAudioSegmentsCommand
    ) -> Result[MergeAudioSegmentsDto, Exception]:
        """Execute the merge audio segments use case."""
        # Merge segments
        merge_result = await self._audio_merger.merge(
            segment_paths=command.segment_paths,
            output_path=command.output_path,
            format=command.format,
            normalize=command.normalize,
        )

        if isinstance(merge_result, Err):
            return merge_result

        merged_audio = merge_result.value

        # Calculate total duration
        total_duration = merged_audio.get_duration_seconds()

        # Get file size
        file_size = merged_audio.get_file_size_bytes()

        # Create DTO
        dto = MergeAudioSegmentsDto(
            output_path=merged_audio.get_path(),
            total_segments=len(command.segment_paths),
            total_duration_seconds=total_duration,
            format=merged_audio.get_format(),
            file_size_bytes=file_size,
        )

        return Ok(dto)
