"""VOD download failed error."""

from dataclasses import dataclass


@dataclass(frozen=True)
class VodDownloadFailedError:
    """Error when VOD download fails."""

    vod_id: str
    platform: str
    reason: str

    def __str__(self) -> str:
        """String representation."""
        return f"Failed to download VOD {self.vod_id} from {self.platform}: {self.reason}"
