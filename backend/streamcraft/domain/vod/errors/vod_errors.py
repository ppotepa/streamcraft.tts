"""VOD domain errors."""

from dataclasses import dataclass

from streamcraft.domain.shared.errors import DomainError, ValidationError


@dataclass(frozen=True, slots=True)
class InvalidVodUrlError(ValidationError):
    """Error when VOD URL is invalid."""

    def __init__(self, url: str, reason: str) -> None:
        """Initialize invalid URL error."""
        super().__init__(field="vod_url", value=url, message=f"Invalid VOD URL: {reason}")
        object.__setattr__(self, "code", "INVALID_VOD_URL")


@dataclass(frozen=True, slots=True)
class MetadataFetchFailedError(DomainError):
    """Error when fetching VOD metadata fails."""

    vod_id: str
    reason: str

    def __init__(self, vod_id: str, reason: str) -> None:
        """Initialize metadata fetch error."""
        object.__setattr__(self, "vod_id", vod_id)
        object.__setattr__(self, "reason", reason)
        object.__setattr__(self, "message", f"Failed to fetch metadata for {vod_id}: {reason}")
        object.__setattr__(self, "code", "METADATA_FETCH_FAILED")
