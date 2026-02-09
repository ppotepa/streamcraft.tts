"""Fail job step handler."""

from streamcraft.application.job.fail_job_step.command import FailJobStepCommand
from streamcraft.application.job.fail_job_step.dto import FailJobStepDto
from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.job import JobNotFoundError
from streamcraft.domain.job.repository import JobRepository


class FailJobStepHandler:
    """Handler for failing a job step."""

    def __init__(self, job_repository: JobRepository) -> None:
        """Initialize handler with dependencies."""
        self._job_repository = job_repository

    def handle(self, command: FailJobStepCommand) -> Result[FailJobStepDto, JobNotFoundError]:
        """Mark a job step as failed and transition to error state."""
        # Find the job
        find_result = self._job_repository.find_by_id(command.job_id)
        if isinstance(find_result, Err):
            return find_result

        job = find_result.value

        # Fail the step (domain logic handles state transition to error)
        job.fail_step(command.step_name, command.error_message)

        # Save updated job
        save_result = self._job_repository.save(job)
        if isinstance(save_result, Err):
            return save_result

        # Get status (should now be error)
        status = job.status()

        # Create DTO
        dto = FailJobStepDto(
            job_id=job.id(),
            failed_step=command.step_name,
            status_kind="error",
            error_message=status.get("error_message", command.error_message),
        )

        return Ok(dto)
