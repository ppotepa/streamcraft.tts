"""Start job step use case command."""

from dataclasses import dataclass

from streamcraft.domain.job.value_objects.step_name import StepName
from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True, slots=True)
class StartJobStepCommand:
    """Command to start a job step."""

    job_id: JobId
    step_name: StepName
