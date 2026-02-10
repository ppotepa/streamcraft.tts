"""VOD domain."""

from streamcraft.domain.shared.branded_types import VodId, StreamerId
from streamcraft.domain.vod.errors import InvalidVodUrlError, MetadataFetchFailedError, VodDownloadFailedError
from streamcraft.domain.vod.value_objects import Platform

__all__ = [
    "InvalidVodUrlError",
    "MetadataFetchFailedError",
    "Platform",
    "StreamerId",
    "VodDownloadFailedError",
    "VodId",
]
