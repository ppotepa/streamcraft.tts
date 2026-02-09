"""Analyze audio quality use case handler."""

from streamcraft.application.audio.analyze_audio_quality.command import AnalyzeAudioQualityCommand
from streamcraft.application.audio.analyze_audio_quality.dto import AnalyzeAudioQualityDto
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.audio.ports.audio_quality_analyzer import AudioQualityAnalyzer
from streamcraft.domain.shared.result import Result, Success


class AnalyzeAudioQualityHandler(UseCase[AnalyzeAudioQualityCommand, AnalyzeAudioQualityDto, Exception]):
    """Use case handler for analyzing audio quality."""

    def __init__(self, quality_analyzer: AudioQualityAnalyzer) -> None:
        """Initialize handler with quality analyzer."""
        self._quality_analyzer = quality_analyzer

    def execute(self, request: AnalyzeAudioQualityCommand) -> Result[AnalyzeAudioQualityDto, Exception]:
        """Execute audio quality analysis use case."""
        # Analyze RMS
        rms_result = self._quality_analyzer.analyze_rms(request.audio_path)

        if rms_result.is_failure():
            return rms_result

        rms_db = rms_result.unwrap()

        # Calculate quality score
        score_result = self._quality_analyzer.calculate_quality_score(request.audio_path)

        if score_result.is_failure():
            return score_result

        quality_score = score_result.unwrap()

        # Convert to DTO
        dto = AnalyzeAudioQualityDto(
            audio_path=str(request.audio_path),
            rms_db=rms_db.value,
            quality_score=quality_score,
            is_silence=rms_db.is_silence(),
            is_clipping=rms_db.is_clipping(),
        )

        return Success(value=dto)
