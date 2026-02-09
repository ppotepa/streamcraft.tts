"""Download VOD command."""

from dataclasses import dataclass
from pathlib import Path

from streamcraft.domain.vod.value_objects.platform import Platform
from streamcraft.domain.vod.value_objects.vod_id import VodId


@dataclass(frozen=True)
class DownloadVodCommand:
    """Command to download a VOD video file."""

    vod_id: VodId
    platform: Platform
    output_directory: Path
