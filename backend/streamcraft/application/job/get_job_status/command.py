"""Get job status use case command."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True, slots=True)
class GetJobStatusCommand:
    """Command to get job status."""

    job_id: JobId
