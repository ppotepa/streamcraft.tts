"""Fetch VOD metadata use case command."""

from dataclasses import dataclass

from streamcraft.domain.vod import Platform, VodId


@dataclass(frozen=True, slots=True)
class FetchVodMetadataCommand:
    """Command to fetch VOD metadata."""

    vod_id: VodId
    platform: Platform
