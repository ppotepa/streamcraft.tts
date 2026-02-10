"""FastAPI dependency injection."""

from pathlib import Path

from streamcraft.application.audio.analyze_audio_quality import AnalyzeAudioQualityHandler
from streamcraft.application.audio.extract_audio import ExtractAudioHandler
from streamcraft.application.audio.merge_audio_segments import MergeAudioSegmentsHandler
from streamcraft.application.audio.slice_audio_segments import SliceAudioSegmentsHandler
from streamcraft.application.dataset.create_dataset import CreateDatasetHandler
from streamcraft.application.dataset.export_dataset import ExportDatasetHandler
from streamcraft.application.dataset.split_dataset import SplitDatasetHandler
from streamcraft.application.dataset.validate_dataset import ValidateDatasetHandler
from streamcraft.application.job.cancel_job import CancelJobHandler
from streamcraft.application.job.complete_job_step import CompleteJobStepHandler
from streamcraft.application.job.create_job.handler import CreateJobHandler
from streamcraft.application.job.fail_job_step import FailJobStepHandler
from streamcraft.application.job.get_job_status import GetJobStatusHandler
from streamcraft.application.job.list_jobs import ListJobsHandler
from streamcraft.application.job.retry_job import RetryJobHandler
from streamcraft.application.job.start_job_step import StartJobStepHandler
from streamcraft.application.transcription.filter_transcript_cues import FilterTranscriptCuesHandler
from streamcraft.application.transcription.get_transcript import GetTranscriptHandler
from streamcraft.application.transcription.parse_subtitles import ParseSubtitlesHandler
from streamcraft.application.transcription.transcribe_audio import TranscribeAudioHandler
from streamcraft.application.vod.download_vod import DownloadVodHandler
from streamcraft.application.vod.fetch_vod_metadata import FetchVodMetadataHandler
from streamcraft.infrastructure.audio.ffmpeg import FFmpegAudioExtractor, FFmpegAudioMerger, FFmpegAudioSlicer
from streamcraft.infrastructure.audio.soundfile import SoundfileAudioAnalyzer
from streamcraft.infrastructure.dataset.validator.dataset_validator_impl import DatasetValidatorImpl
from streamcraft.infrastructure.dataset.writer.file_dataset_writer import FileDatasetWriter
from streamcraft.infrastructure.dataset.splitter.dataset_splitter_impl import DatasetSplitterImpl
from streamcraft.infrastructure.transcription.whisper.whisper_transcriber import WhisperTranscriber
from streamcraft.infrastructure.transcription.parser.subtitle_parser import SubtitleParserImpl
from streamcraft.infrastructure.external_apis.twitch import TwitchApiClient, TwitchVodDownloader
from streamcraft.infrastructure.external_apis.youtube import YouTubeVodDownloader
from streamcraft.domain.vod.value_objects.platform import Platform
from streamcraft.infrastructure.persistence.file_system.json_job_repository import (
    JsonJobRepository,
)
from streamcraft.infrastructure.persistence.memory import (
    MemoryDatasetRepository,
    MemoryTranscriptionRepository,
)


_job_repository: JsonJobRepository | None = None
_transcription_repository: MemoryTranscriptionRepository | None = None
_dataset_repository: MemoryDatasetRepository | None = None


def get_job_repository() -> JsonJobRepository:
    """Get or create job repository singleton."""
    global _job_repository
    if _job_repository is None:
        _job_repository = JsonJobRepository(file_path=Path("temp/jobs.json"))
    return _job_repository


def get_transcription_repository() -> MemoryTranscriptionRepository:
    """Get or create transcription repository singleton."""
    global _transcription_repository
    if _transcription_repository is None:
        _transcription_repository = MemoryTranscriptionRepository()
    return _transcription_repository


def get_dataset_repository() -> MemoryDatasetRepository:
    """Get or create dataset repository singleton."""
    global _dataset_repository
    if _dataset_repository is None:
        _dataset_repository = MemoryDatasetRepository()
    return _dataset_repository


def get_create_job_handler() -> CreateJobHandler:
    """Get create job handler with dependencies."""
    return CreateJobHandler(job_repository=get_job_repository())


def get_get_job_status_handler() -> GetJobStatusHandler:
    """Get job status handler with dependencies."""
    return GetJobStatusHandler(job_repository=get_job_repository())


def get_list_jobs_handler() -> ListJobsHandler:
    """Get list jobs handler with dependencies."""
    return ListJobsHandler(job_repository=get_job_repository())


def get_start_job_step_handler() -> StartJobStepHandler:
    """Get start job step handler with dependencies."""
    return StartJobStepHandler(job_repository=get_job_repository())


def get_fetch_vod_metadata_handler() -> FetchVodMetadataHandler:
    """Get fetch VOD metadata handler with dependencies."""
    from streamcraft.settings import get_settings
    
    settings = get_settings()
    
    # For now, use Twitch as primary. In production, create a composite fetcher
    # that selects the right client based on platform.
    if settings.twitch_client_id and settings.twitch_client_secret:
        twitch_client = TwitchApiClient(
            client_id=settings.twitch_client_id,
            client_secret=settings.twitch_client_secret
        )
        return FetchVodMetadataHandler(metadata_fetcher=twitch_client)
    elif settings.youtube_api_key:
        from streamcraft.infrastructure.vod.youtube import YouTubeApiClient
        youtube_client = YouTubeApiClient(api_key=settings.youtube_api_key)
        return FetchVodMetadataHandler(metadata_fetcher=youtube_client)
    else:
        # Fallback to placeholder (will fail but won't crash)
        twitch_client = TwitchApiClient(
            client_id="TWITCH_CLIENT_ID_NOT_SET",
            client_secret="TWITCH_CLIENT_SECRET_NOT_SET"
        )
        return FetchVodMetadataHandler(metadata_fetcher=twitch_client)


def get_extract_audio_handler() -> ExtractAudioHandler:
    """Get extract audio handler with dependencies."""
    extractor = FFmpegAudioExtractor()
    return ExtractAudioHandler(audio_extractor=extractor)


def get_analyze_audio_quality_handler() -> AnalyzeAudioQualityHandler:
    """Get analyze audio quality handler with dependencies."""
    analyzer = SoundfileAudioAnalyzer()
    return AnalyzeAudioQualityHandler(quality_analyzer=analyzer)


def get_complete_job_step_handler() -> CompleteJobStepHandler:
    """Get complete job step handler with dependencies."""
    return CompleteJobStepHandler(job_repository=get_job_repository())


def get_fail_job_step_handler() -> FailJobStepHandler:
    """Get fail job step handler with dependencies."""
    return FailJobStepHandler(job_repository=get_job_repository())


def get_cancel_job_handler() -> CancelJobHandler:
    """Get cancel job handler with dependencies."""
    return CancelJobHandler(job_repository=get_job_repository())


def get_retry_job_handler() -> RetryJobHandler:
    """Get retry job handler with dependencies."""
    return RetryJobHandler(job_repository=get_job_repository())


def get_download_vod_handler() -> DownloadVodHandler:
    """Get download VOD handler with dependencies."""
    # Create a simple router that delegates to platform-specific downloaders
    class MultiPlatformVodDownloader:
        def __init__(self):
            self._twitch = TwitchVodDownloader()
            self._youtube = YouTubeVodDownloader()
        
        def download(self, vod_id, platform, output_path):
            if platform == Platform.TWITCH:
                return self._twitch.download(vod_id, platform, output_path)
            elif platform == Platform.YOUTUBE:
                return self._youtube.download(vod_id, platform, output_path)
            else:
                from streamcraft.domain.vod.errors import VodDownloadFailedError
                from streamcraft.domain.common.result import Err
                return Err(VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason=f"Unsupported platform: {platform}"
                ))
    
    return DownloadVodHandler(vod_downloader=MultiPlatformVodDownloader())


def get_transcribe_audio_handler() -> TranscribeAudioHandler:
    """Get transcribe audio handler with dependencies."""
    transcriber = WhisperTranscriber(model_size="base", device="auto")
    return TranscribeAudioHandler(
        transcriber=transcriber,
        transcription_repository=get_transcription_repository(),
    )


def get_get_transcript_handler() -> GetTranscriptHandler:
    """Get transcript handler with dependencies."""
    return GetTranscriptHandler(transcription_repository=get_transcription_repository())


def get_parse_subtitles_handler() -> ParseSubtitlesHandler:
    """Get parse subtitles handler with dependencies."""
    parser = SubtitleParserImpl()
    return ParseSubtitlesHandler(
        subtitle_parser=parser,
        transcription_repository=get_transcription_repository(),
    )


def get_filter_transcript_cues_handler() -> FilterTranscriptCuesHandler:
    """Get filter transcript cues handler with dependencies."""
    return FilterTranscriptCuesHandler(transcription_repository=get_transcription_repository())


def get_create_dataset_handler() -> CreateDatasetHandler:
    """Get create dataset handler with dependencies."""
    return CreateDatasetHandler(dataset_repository=get_dataset_repository())


def get_validate_dataset_handler() -> ValidateDatasetHandler:
    """Get validate dataset handler with dependencies."""
    validator = DatasetValidatorImpl()
    return ValidateDatasetHandler(
        dataset_repository=get_dataset_repository(), dataset_validator=validator
    )


def get_export_dataset_handler() -> ExportDatasetHandler:
    """Get export dataset handler with dependencies."""
    writer = FileDatasetWriter()
    return ExportDatasetHandler(
        dataset_repository=get_dataset_repository(),
        dataset_writer=writer,
    )


def get_split_dataset_handler() -> SplitDatasetHandler:
    """Get split dataset handler with dependencies."""
    splitter = DatasetSplitterImpl(seed=42)
    return SplitDatasetHandler(
        dataset_repository=get_dataset_repository(),
        dataset_splitter=splitter,
    )

