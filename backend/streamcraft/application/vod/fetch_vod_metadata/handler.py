"""Fetch VOD metadata use case handler."""

from streamcraft.application.shared.use_case import UseCase
from streamcraft.application.vod.fetch_vod_metadata.command import FetchVodMetadataCommand
from streamcraft.application.vod.fetch_vod_metadata.dto import FetchVodMetadataDto
from streamcraft.domain.shared.result import Result, Success
from streamcraft.domain.vod.errors.vod_errors import MetadataFetchFailedError
from streamcraft.domain.vod.ports.vod_metadata_fetcher import VodMetadataFetcher


class FetchVodMetadataHandler(
    UseCase[FetchVodMetadataCommand, FetchVodMetadataDto, MetadataFetchFailedError]
):
    """Use case handler for fetching VOD metadata."""

    def __init__(self, metadata_fetcher: VodMetadataFetcher) -> None:
        """Initialize handler with metadata fetcher."""
        self._metadata_fetcher = metadata_fetcher

    def execute(
        self, request: FetchVodMetadataCommand
    ) -> Result[FetchVodMetadataDto, MetadataFetchFailedError]:
        """Execute fetch VOD metadata use case."""
        # Fetch metadata
        result = self._metadata_fetcher.fetch(request.vod_id)

        if result.is_failure():
            return result

        metadata = result.unwrap()

        # Convert to DTO
        dto = FetchVodMetadataDto(
            vod_id=request.vod_id,
            streamer=metadata.streamer,
            title=metadata.title,
            duration_seconds=metadata.duration.seconds,
            preview_url=metadata.preview_url,
            platform=metadata.platform.value,
            description=metadata.description,
            url=metadata.url,
            view_count=metadata.view_count,
            created_at=metadata.created_at,
            published_at=metadata.published_at,
            language=metadata.language,
            user_id=metadata.user_id,
            user_login=metadata.user_login,
            video_type=metadata.video_type,
            game_id=metadata.game_id,
            game_name=metadata.game_name,
        )

        return Success(value=dto)
