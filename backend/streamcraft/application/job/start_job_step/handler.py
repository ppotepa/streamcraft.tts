"""Start job step use case handler."""

from streamcraft.application.job.start_job_step.command import StartJobStepCommand
from streamcraft.application.job.start_job_step.dto import StartJobStepDto
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.job.errors.job_errors import InvalidJobTransitionError, JobNotFoundError
from streamcraft.domain.job.ports.job_repository import JobRepository
from streamcraft.domain.shared.result import Result, Success


class StartJobStepHandler(
    UseCase[StartJobStepCommand, StartJobStepDto, JobNotFoundError | InvalidJobTransitionError]
):
    """Use case handler for starting a job step."""

    def __init__(self, job_repository: JobRepository) -> None:
        """Initialize handler with job repository."""
        self._job_repository = job_repository

    def execute(
        self, request: StartJobStepCommand
    ) -> Result[StartJobStepDto, JobNotFoundError | InvalidJobTransitionError]:
        """Execute start job step use case."""
        # Find job
        find_result = self._job_repository.find_by_id(request.job_id)

        if find_result.is_failure():
            return find_result

        job = find_result.unwrap()

        # Start step
        step_result = job.start_step(request.step_name)

        if step_result.is_failure():
            return step_result

        updated_job = step_result.unwrap()

        # Save updated job
        save_result = self._job_repository.save(updated_job)

        if save_result.is_failure():
            return save_result

        # Convert to DTO
        dto = StartJobStepDto(
            job_id=updated_job.id,
            current_step=str(updated_job.status.current_step),
            status_kind=updated_job.status.kind.value,
        )

        return Success(value=dto)
