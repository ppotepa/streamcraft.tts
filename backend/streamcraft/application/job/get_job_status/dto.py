"""Get job status use case DTO."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True, slots=True)
class GetJobStatusDto:
    """DTO for job status result."""

    job_id: JobId
    vod_url: str
    status_kind: str
    current_step: str | None
    progress: float | None
    error_message: str | None
    created_at: str
    updated_at: str
