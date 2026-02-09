"""Fetch VOD metadata use case command."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import VodId
from streamcraft.domain.vod.value_objects.platform import Platform


@dataclass(frozen=True, slots=True)
class FetchVodMetadataCommand:
    """Command to fetch VOD metadata."""

    vod_id: VodId
    platform: Platform
