"""Download VOD command."""

from dataclasses import dataclass
from pathlib import Path

from streamcraft.domain.vod import Platform, VodId


@dataclass(frozen=True)
class DownloadVodCommand:
    """Command to download a VOD video file."""

    vod_id: VodId
    platform: Platform
    output_directory: Path
