"""VOD entity."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import VodId
from streamcraft.domain.vod.value_objects.vod_metadata import VodMetadata
from streamcraft.domain.vod.value_objects.vod_url import VodUrl


@dataclass(frozen=True, slots=True)
class Vod:
    """VOD entity."""

    id: VodId
    url: VodUrl
    metadata: VodMetadata | None = None

    def with_metadata(self, metadata: VodMetadata) -> "Vod":
        """Create a new Vod with metadata."""
        return Vod(id=self.id, url=self.url, metadata=metadata)
