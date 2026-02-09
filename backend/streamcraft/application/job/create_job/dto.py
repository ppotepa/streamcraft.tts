"""Create job command DTO."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CreateJobDto:
    """DTO for created job."""

    job_id: str
    vod_id: str
    vod_url: str
    status: str
    created_at: str
