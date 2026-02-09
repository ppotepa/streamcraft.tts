"""Complete job step command."""

from dataclasses import dataclass

from streamcraft.domain.job import JobId, StepName


@dataclass(frozen=True)
class CompleteJobStepCommand:
    """Command to mark a job step as completed."""

    job_id: JobId
    step_name: StepName
