"""Fail job step command."""

from dataclasses import dataclass

from streamcraft.domain.job import JobId, StepName


@dataclass(frozen=True)
class FailJobStepCommand:
    """Command to mark a job step as failed."""

    job_id: JobId
    step_name: StepName
    error_message: str
