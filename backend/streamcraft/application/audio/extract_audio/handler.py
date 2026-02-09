"""Extract audio use case handler."""

from streamcraft.application.audio.extract_audio.command import ExtractAudioCommand
from streamcraft.application.audio.extract_audio.dto import ExtractAudioDto
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.audio.errors.audio_errors import ExtractionFailedError
from streamcraft.domain.audio.ports.audio_extractor import AudioExtractor
from streamcraft.domain.shared.result import Result, Success


class ExtractAudioHandler(UseCase[ExtractAudioCommand, ExtractAudioDto, ExtractionFailedError]):
    """Use case handler for extracting audio from video."""

    def __init__(self, audio_extractor: AudioExtractor) -> None:
        """Initialize handler with audio extractor."""
        self._audio_extractor = audio_extractor

    def execute(self, request: ExtractAudioCommand) -> Result[ExtractAudioDto, ExtractionFailedError]:
        """Execute audio extraction use case."""
        # Extract audio
        result = self._audio_extractor.extract(
            video_path=request.video_path,
            output_path=request.output_path,
            audio_only=request.audio_only,
        )

        if result.is_failure():
            return result

        audio_file = result.unwrap()

        # Convert to DTO
        dto = ExtractAudioDto(
            audio_file_id=audio_file.id,
            output_path=str(audio_file.path),
            duration_seconds=audio_file.duration.seconds,
            size_megabytes=audio_file.megabytes,
            sample_rate_hz=audio_file.sample_rate.hertz,
            format=str(audio_file.format),
        )

        return Success(value=dto)
