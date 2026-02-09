"""Complete job step DTO."""

from dataclasses import dataclass
from typing import Literal

from streamcraft.domain.job import JobId, StepName


@dataclass(frozen=True)
class CompleteJobStepDto:
    """DTO for complete job step response."""

    job_id: JobId
    completed_step: StepName
    status_kind: Literal["idle", "running", "done", "error"]
    next_step: StepName | None
