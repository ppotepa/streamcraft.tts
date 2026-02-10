"""VOD metadata value object."""

from dataclasses import dataclass

from streamcraft.domain.shared.value_objects import Duration
from streamcraft.domain.vod.value_objects.platform import Platform


@dataclass(frozen=True, slots=True)
class VodMetadata:
    """VOD metadata information."""

    streamer: str
    title: str
    duration: Duration
    preview_url: str | None
    platform: Platform
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

    def __post_init__(self) -> None:
        """Validate metadata."""
        if not self.streamer:
            raise ValueError("Streamer name cannot be empty")
        if not self.title:
            raise ValueError("Title cannot be empty")
