"""VOD downloader port."""

from abc import ABC, abstractmethod
from pathlib import Path

from streamcraft.domain.common.result import Result
from streamcraft.domain.shared.branded_types import VodId
from streamcraft.domain.vod.errors import VodDownloadFailedError
from streamcraft.domain.vod.value_objects import Platform


class VodDownloader(ABC):
    """Port for downloading VOD files from platforms."""

    @abstractmethod
    def download(
        self,
        vod_id: VodId,
        platform: Platform,
        output_path: Path,
    ) -> Result[Path, VodDownloadFailedError]:
        """Download VOD video file to specified path.

        Args:
            vod_id: The ID of the VOD to download
            platform: The platform (Twitch or YouTube)
            output_path: Directory where the video file should be saved

        Returns:
            Result containing the actual file path if successful,
            or VodDownloadFailedError if download failed.
        """
        pass
