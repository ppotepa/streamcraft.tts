"""YouTube VOD downloader adapter."""

import subprocess
from pathlib import Path

from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.vod.errors import VodDownloadFailedError
from streamcraft.domain.vod.ports import VodDownloader
from streamcraft.domain.vod.value_objects.platform import Platform
from streamcraft.domain.vod.value_objects.vod_id import VodId


class YouTubeVodDownloader(VodDownloader):
    """YouTube VOD downloader using yt-dlp."""

    def download(
        self,
        vod_id: VodId,
        platform: Platform,
        output_path: Path,
    ) -> Result[Path, VodDownloadFailedError]:
        """Download YouTube video using yt-dlp command-line tool.

        Args:
            vod_id: The YouTube video ID
            platform: Must be Platform.YOUTUBE
            output_path: Directory where the video should be downloaded

        Returns:
            Result containing the downloaded file path or error.
        """
        if platform != Platform.YOUTUBE:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason="YouTubeVodDownloader only supports YouTube platform",
                )
            )

        try:
            # Build YouTube video URL
            video_url = f"https://www.youtube.com/watch?v={vod_id}"
            
            # Output template for yt-dlp
            output_template = str(output_path / f"{vod_id}.%(ext)s")
            
            # Build yt-dlp command
            command = [
                "yt-dlp",
                video_url,
                "-f", "best",  # Download best format
                "-o", output_template,
                "--no-playlist",  # Don't download playlists
                "--no-warnings",
            ]

            # Execute command
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=3600,  # 1 hour timeout
            )

            # Find the downloaded file
            # yt-dlp may use different extensions (mp4, webm, mkv)
            for ext in ["mp4", "webm", "mkv", "avi"]:
                expected_file = output_path / f"{vod_id}.{ext}"
                if expected_file.exists():
                    return Ok(expected_file)

            # If no file found with common extensions, search directory
            matching_files = list(output_path.glob(f"{vod_id}.*"))
            if matching_files:
                return Ok(matching_files[0])

            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason=f"Download completed but file not found in {output_path}",
                )
            )

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
                    reason=f"yt-dlp command failed: {e.stderr}",
                )
            )
        except FileNotFoundError:
            return Err(
                VodDownloadFailedError(
                    vod_id=vod_id,
                    platform=str(platform),
                    reason="yt-dlp not found. Install with: pip install yt-dlp",
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
