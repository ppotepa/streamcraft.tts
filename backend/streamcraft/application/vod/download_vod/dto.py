"""Download VOD DTO."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DownloadVodDto:
    """DTO for download VOD response."""

    vod_id: str
    platform: str
    downloaded_file_path: Path
    file_size_bytes: int
