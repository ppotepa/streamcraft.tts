"""Start job step use case DTO."""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True, slots=True)
class StartJobStepDto:
    """DTO for start job step result."""

    job_id: JobId
    current_step: str
    status_kind: str
