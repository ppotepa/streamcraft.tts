"""Twitch VOD downloader adapter."""

import subprocess
from pathlib import Path

from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.vod.errors import VodDownloadFailedError
from streamcraft.domain.vod.ports import VodDownloader
from streamcraft.domain.vod.value_objects.platform import Platform
from streamcraft.domain.vod.value_objects.vod_id import VodId


class TwitchVodDownloader(VodDownloader):
    """Twitch VOD downloader using twitch-dl CLI."""

    def download(
        self,
        vod_id: VodId,
        platform: Platform,
        output_path: Path,
    ) -> Result[Path, VodDownloadFailedError]:
        """Download Twitch VOD using twitch-dl command-line tool.

        Args:
            vod_id: The Twitch VOD ID
            platform: Must be Platform.TWITCH
            output_path: Directory where the video should be downloaded

        Returns:
            Result containing the downloaded file path or error.
        """
        if platform != Platform.TWITCH:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason="TwitchVodDownloader only supports Twitch platform",
                )
            )

        try:
            # Build twitch-dl download command
            # Format: twitch-dl download <vod_id> -o <output_path>
            output_template = str(output_path / f"{vod_id}.mp4")
            
            command = [
                "twitch-dl",
                "download",
                vod_id,
                "-q", "best",  # Download best quality
                "-o", output_template,
            ]

            # Execute command
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=3600,  # 1 hour timeout
            )

            # Check if file was created
            expected_file = Path(output_template)
            if not expected_file.exists():
                return Err(
                    VodDownloadFailedError(
                        vod_id=vod_id,
                        platform=str(platform),
                        reason=f"Download completed but file not found at {expected_file}",
                    )
                )

            return Ok(expected_file)

        except subprocess.TimeoutExpired:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason="Download timed out after 1 hour",
                )
            )
        except subprocess.CalledProcessError as e:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason=f"twitch-dl command failed: {e.stderr}",
                )
            )
        except FileNotFoundError:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason="twitch-dl not found. Install with: pip install twitch-dl",
                )
            )
        except Exception as e:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason=f"Unexpected error: {str(e)}",
                )
            )
