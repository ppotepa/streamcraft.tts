"""
YouTube API Client Adapter
"""

from typing import Optional
import re

from ....domain.shared.result import Result, Err, Ok
from ....domain.vod.entities import VodMetadata
from ....domain.vod.ports import VodMetadataFetcher
from ....domain.vod.value_objects import VodId, Platform


class YouTubeApiClient(VodMetadataFetcher):
    """YouTube API client for fetching VOD metadata."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        """Initialize YouTube API client."""
        self._api_key = api_key

    async def fetch(self, vod_id: VodId, platform: Platform) -> Result[VodMetadata, Exception]:
        """Fetch VOD metadata from YouTube API."""
        if platform != "youtube":
            return Err(ValueError(f"Invalid platform: {platform}, expected 'youtube'"))

        try:
            # Extract video ID from various URL formats
            video_id = self._extract_video_id(vod_id)

            # Note: Real implementation would use YouTube Data API v3
            # For now, this is a placeholder structure
            if not self._api_key:
                return Err(Exception("YouTube API key not configured"))

            # Placeholder for actual API call
            # In real implementation:
            # response = await self._make_api_request(video_id)
            # metadata = self._parse_response(response)

            # Return error for now since this needs actual API implementation
            return Err(
                NotImplementedError(
                    "YouTube API integration requires API key and full implementation"
                )
            )

        except Exception as e:
            return Err(e)

    def _extract_video_id(self, vod_id: VodId) -> str:
        """Extract video ID from various YouTube URL formats."""
        url = str(vod_id)

        # Standard watch URL: youtube.com/watch?v=VIDEO_ID
        match = re.search(r"watch\?v=([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)

        # Short URL: youtu.be/VIDEO_ID
        match = re.search(r"youtu\.be/([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)

        # Embed URL: youtube.com/embed/VIDEO_ID
        match = re.search(r"embed/([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)

        # Direct video ID
        if re.match(r"^[a-zA-Z0-9_-]{11}$", url):
            return url

        raise ValueError(f"Could not extract video ID from: {url}")
