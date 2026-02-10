"""Complete job step handler."""

from streamcraft.application.job.complete_job_step.command import CompleteJobStepCommand
from streamcraft.application.job.complete_job_step.dto import CompleteJobStepDto
from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.job import JobNotFoundError, JobRepository


class CompleteJobStepHandler:
    """Handler for completing a job step."""

    def __init__(self, job_repository: JobRepository) -> None:
        """Initialize handler with dependencies."""
        self._job_repository = job_repository

    def handle(self, command: CompleteJobStepCommand) -> Result[CompleteJobStepDto, JobNotFoundError]:
        """Complete a job step and transition to next step or done state."""
        # Find the job
        find_result = self._job_repository.find_by_id(command.job_id)
        if isinstance(find_result, Err):
            return find_result

        job = find_result.value

        # Complete the step (domain logic handles state transition)
        job.complete_step(command.step_name)

        # Save updated job
        save_result = self._job_repository.save(job)
        if isinstance(save_result, Err):
            return save_result

        # Determine next step based on current status
        next_step: str | None = None
        status = job.status()
        if status["kind"] == "running":
            next_step = status["current_step"]

        # Create DTO
        dto = CompleteJobStepDto(
            job_id=job.id(),
            completed_step=command.step_name,
            status_kind=status["kind"],
            next_step=next_step,
        )

        return Ok(dto)
