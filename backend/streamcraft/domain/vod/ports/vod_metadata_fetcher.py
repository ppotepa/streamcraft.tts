"""VOD metadata fetcher port."""

from abc import ABC, abstractmethod

from streamcraft.domain.shared.branded_types import VodId
from streamcraft.domain.shared.result import Result
from streamcraft.domain.vod.errors.vod_errors import MetadataFetchFailedError
from streamcraft.domain.vod.value_objects.vod_metadata import VodMetadata


class VodMetadataFetcher(ABC):
    """Port for fetching VOD metadata from external sources."""

    @abstractmethod
    def fetch(self, vod_id: VodId) -> Result[VodMetadata, MetadataFetchFailedError]:
        """Fetch metadata for a VOD."""
        ...
