"""List jobs use case DTO."""

from dataclasses import dataclass
from typing import Sequence

from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True, slots=True)
class JobSummaryDto:
    """Summary DTO for a single job."""

    job_id: JobId
    vod_url: str
    status_kind: str
    created_at: str


@dataclass(frozen=True, slots=True)
class ListJobsDto:
    """DTO for list jobs result."""

    jobs: Sequence[JobSummaryDto]
    total_count: int
