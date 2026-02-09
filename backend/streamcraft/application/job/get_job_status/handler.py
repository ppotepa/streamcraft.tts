"""Get job status use case handler."""

from streamcraft.application.job.get_job_status.command import GetJobStatusCommand
from streamcraft.application.job.get_job_status.dto import GetJobStatusDto
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.job.errors.job_errors import JobNotFoundError
from streamcraft.domain.job.ports.job_repository import JobRepository
from streamcraft.domain.shared.result import Result, Success


class GetJobStatusHandler(UseCase[GetJobStatusCommand, GetJobStatusDto, JobNotFoundError]):
    """Use case handler for getting job status."""

    def __init__(self, job_repository: JobRepository) -> None:
        """Initialize handler with job repository."""
        self._job_repository = job_repository

    def execute(self, request: GetJobStatusCommand) -> Result[GetJobStatusDto, JobNotFoundError]:
        """Execute get job status use case."""
        # Find job
        result = self._job_repository.find_by_id(request.job_id)

        if result.is_failure():
            return result

        job = result.unwrap()

        # Extract status details
        status = job.status
        current_step = None
        progress = None
        error_message = None

        if status.kind.value == "running":
            current_step = str(status.current_step)
            progress = status.progress
        elif status.kind.value == "error":
            error_message = status.message

        # Convert to DTO
        dto = GetJobStatusDto(
            job_id=job.id,
            vod_url=str(job.vod_url),
            status_kind=status.kind.value,
            current_step=current_step,
            progress=progress,
            error_message=error_message,
            created_at=job.created_at.toIso(),
            updated_at=job.updated_at.toIso(),
        )

        return Success(value=dto)
