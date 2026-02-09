"""Fail job step DTO."""

from dataclasses import dataclass
from typing import Literal

from streamcraft.domain.job import JobId, StepName


@dataclass(frozen=True)
class FailJobStepDto:
    """DTO for fail job step response."""

    job_id: JobId
    failed_step: StepName
    status_kind: Literal["error"]
    error_message: str
