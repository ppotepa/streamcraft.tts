"""Fetch VOD metadata use case DTO."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import VodId


@dataclass(frozen=True, slots=True)
class FetchVodMetadataDto:
    """DTO for fetched VOD metadata."""

    vod_id: VodId
    streamer: str
    title: str
    duration_seconds: float
    preview_url: str | None
    platform: str
