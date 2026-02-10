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
    description: str | None = None
    url: str | None = None
    view_count: int | None = None
    created_at: str | None = None
    published_at: str | None = None
    language: str | None = None
    user_id: str | None = None
    user_login: str | None = None
    video_type: str | None = None
    game_id: str | None = None
    game_name: str | None = None
