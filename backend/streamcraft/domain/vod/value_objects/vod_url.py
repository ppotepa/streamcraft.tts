"""VOD URL value object with validation."""

import re
from dataclasses import dataclass

from streamcraft.domain.vod.errors.vod_errors import InvalidVodUrlError
from streamcraft.domain.vod.value_objects.platform import Platform


@dataclass(frozen=True, slots=True)
class VodUrl:
    """Validated VOD URL."""

    url: str
    platform: Platform

    def __post_init__(self) -> None:
        """Validate URL."""
        if not self.url:
            raise InvalidVodUrlError(self.url, "URL cannot be empty")

        if self.platform == Platform.TWITCH:
            if not re.match(r"https?://(www\.)?twitch\.tv/videos/\d+", self.url):
                raise InvalidVodUrlError(
                    self.url, "Invalid Twitch URL format. Expected: twitch.tv/videos/[id]"
                )
        elif self.platform == Platform.YOUTUBE:
            if not re.match(
                r"https?://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]+", self.url
            ):
                raise InvalidVodUrlError(
                    self.url, "Invalid YouTube URL format. Expected: youtube.com/watch?v=[id]"
                )

    @classmethod
    def from_string(cls, url: str) -> "VodUrl":
        """Create VodUrl from string, auto-detecting platform."""
        if "twitch.tv" in url:
            return cls(url=url, platform=Platform.TWITCH)
        elif "youtube.com" in url or "youtu.be" in url:
            return cls(url=url, platform=Platform.YOUTUBE)
        else:
            raise InvalidVodUrlError(url, "Cannot detect platform from URL")

    def extract_id(self) -> str:
        """Extract the VOD ID from the URL."""
        if self.platform == Platform.TWITCH:
            match = re.search(r"/videos/(\d+)", self.url)
            return match.group(1) if match else ""
        elif self.platform == Platform.YOUTUBE:
            match = re.search(r"(?:v=|youtu\.be/)([\w-]+)", self.url)
            return match.group(1) if match else ""
        return ""
