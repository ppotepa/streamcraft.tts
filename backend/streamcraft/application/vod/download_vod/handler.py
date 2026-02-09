"""Download VOD handler."""

from pathlib import Path

from streamcraft.application.vod.download_vod.command import DownloadVodCommand
from streamcraft.application.vod.download_vod.dto import DownloadVodDto
from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.vod.errors import VodDownloadFailedError
from streamcraft.domain.vod.ports import VodDownloader


class DownloadVodHandler:
    """Handler for downloading VOD video files."""

    def __init__(self, vod_downloader: VodDownloader) -> None:
        """Initialize handler with dependencies."""
        self._vod_downloader = vod_downloader

    def handle(self, command: DownloadVodCommand) -> Result[DownloadVodDto, VodDownloadFailedError]:
        """Download VOD video file from platform."""
        # Ensure output directory exists
        command.output_directory.mkdir(parents=True, exist_ok=True)

        # Download the video
        download_result = self._vod_downloader.download(
            vod_id=command.vod_id,
            platform=command.platform,
            output_path=command.output_directory,
        )

        if isinstance(download_result, Err):
            return download_result

        file_path = download_result.value

        # Get file size
        file_size = file_path.stat().st_size if file_path.exists() else 0

        # Create DTO
        dto = DownloadVodDto(
            vod_id=command.vod_id,
            platform=str(command.platform),
            downloaded_file_path=file_path,
            file_size_bytes=file_size,
        )

        return Ok(dto)
