"""Platform value object."""

from enum import Enum


class Platform(str, Enum):
    """Streaming platform."""

    TWITCH = "twitch"
    YOUTUBE = "youtube"

    def __str__(self) -> str:
        """String representation."""
        return self.value

    @property
    def display_name(self) -> str:
        """Get human-readable display name."""
        return self.value.title()
