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
    preview_url: str
    platform: Platform

    def __post_init__(self) -> None:
        """Validate metadata."""
        if not self.streamer:
            raise ValueError("Streamer name cannot be empty")
        if not self.title:
            raise ValueError("Title cannot be empty")
