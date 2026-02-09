"""Create job command."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CreateJobCommand:
    """Command to create a new job."""

    vod_url: str
