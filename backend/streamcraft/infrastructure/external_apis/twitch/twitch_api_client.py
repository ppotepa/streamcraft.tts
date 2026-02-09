"""Twitch API client adapter."""

from streamcraft.domain.shared.branded_types import VodId, create_vod_id
from streamcraft.domain.shared.result import Failure, Result, Success
from streamcraft.domain.shared.value_objects import Duration
from streamcraft.domain.vod.errors.vod_errors import MetadataFetchFailedError
from streamcraft.domain.vod.ports.vod_metadata_fetcher import VodMetadataFetcher
from streamcraft.domain.vod.value_objects.platform import Platform
from streamcraft.domain.vod.value_objects.vod_metadata import VodMetadata


class TwitchApiClient(VodMetadataFetcher):
    """Twitch API client implementation."""

    def __init__(self, client_id: str, client_secret: str) -> None:
        """Initialize Twitch API client."""
        self._client_id = client_id
        self._client_secret = client_secret
        self._access_token: str | None = None

    def fetch(self, vod_id: VodId) -> Result[VodMetadata, MetadataFetchFailedError]:
        """Fetch VOD metadata from Twitch API."""
        try:
            # Ensure we have access token
            if not self._access_token:
                token_result = self._get_access_token()
                if token_result.is_failure():
                    return token_result

            # Fetch video info from Twitch Helix API
            import requests

            headers = {
                "Client-ID": self._client_id,
                "Authorization": f"Bearer {self._access_token}",
            }

            response = requests.get(
                f"https://api.twitch.tv/helix/videos?id={vod_id}",
                headers=headers,
                timeout=10,
            )

            if response.status_code != 200:
                return Failure(
                    error=MetadataFetchFailedError(
                        vod_id=vod_id, reason=f"Twitch API returned {response.status_code}"
                    )
                )

            data = response.json()

            if not data.get("data"):
                return Failure(
                    error=MetadataFetchFailedError(vod_id=vod_id, reason="Video not found")
                )

            video = data["data"][0]

            # Parse duration (format: "1h2m3s")
            duration_str = video["duration"]
            duration_seconds = self._parse_duration(duration_str)

            # Create metadata
            metadata = VodMetadata(
                streamer=video["user_name"],
                title=video["title"],
                duration=Duration(seconds=duration_seconds),
                preview_url=video.get("thumbnail_url"),
                platform=Platform.TWITCH,
            )

            return Success(value=metadata)

        except ImportError:
            return Failure(
                error=MetadataFetchFailedError(
                    vod_id=vod_id, reason="requests library not installed"
                )
            )
        except Exception as e:
            return Failure(error=MetadataFetchFailedError(vod_id=vod_id, reason=str(e)))

    def _get_access_token(self) -> Result[str, MetadataFetchFailedError]:
        """Get OAuth access token from Twitch."""
        try:
            import requests

            response = requests.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "grant_type": "client_credentials",
                },
                timeout=10,
            )

            if response.status_code != 200:
                return Failure(
                    error=MetadataFetchFailedError(
                        vod_id=create_vod_id("unknown"),
                        reason=f"Failed to get access token: {response.status_code}",
                    )
                )

            data = response.json()
            self._access_token = data["access_token"]

            return Success(value=self._access_token)

        except Exception as e:
            return Failure(
                error=MetadataFetchFailedError(
                    vod_id=create_vod_id("unknown"), reason=f"Token fetch failed: {e}"
                )
            )

    def _parse_duration(self, duration_str: str) -> float:
        """Parse Twitch duration string (e.g., '1h2m3s') to seconds."""
        import re

        hours = 0
        minutes = 0
        seconds = 0

        hour_match = re.search(r"(\d+)h", duration_str)
        if hour_match:
            hours = int(hour_match.group(1))

        min_match = re.search(r"(\d+)m", duration_str)
        if min_match:
            minutes = int(min_match.group(1))

        sec_match = re.search(r"(\d+)s", duration_str)
        if sec_match:
            seconds = int(sec_match.group(1))

        return float(hours * 3600 + minutes * 60 + seconds)
