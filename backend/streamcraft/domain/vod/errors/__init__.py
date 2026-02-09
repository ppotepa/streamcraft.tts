"""VOD errors."""

from streamcraft.domain.vod.errors.metadata_fetch_failed_error import MetadataFetchFailedError
from streamcraft.domain.vod.errors.vod_download_failed_error import VodDownloadFailedError

__all__ = [
    "MetadataFetchFailedError",
    "VodDownloadFailedError",
]
