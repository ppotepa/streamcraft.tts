"""List jobs use case handler."""

from streamcraft.application.job.list_jobs.command import ListJobsCommand
from streamcraft.application.job.list_jobs.dto import JobSummaryDto, ListJobsDto
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.job.ports.job_repository import JobRepository
from streamcraft.domain.shared.result import Result, Success


class ListJobsHandler(UseCase[ListJobsCommand, ListJobsDto, Exception]):
    """Use case handler for listing jobs."""

    def __init__(self, job_repository: JobRepository) -> None:
        """Initialize handler with job repository."""
        self._job_repository = job_repository

    def execute(self, request: ListJobsCommand) -> Result[ListJobsDto, Exception]:
        """Execute list jobs use case."""
        # Get all jobs
        result = self._job_repository.find_all()

        if result.is_failure():
            return result

        all_jobs = result.unwrap()

        # Apply pagination
        start = request.offset
        end = start + request.limit if request.limit else None
        paginated_jobs = all_jobs[start:end]

        # Convert to DTOs
        job_summaries = tuple(
            JobSummaryDto(
                job_id=job.id,
                vod_url=str(job.vod_url),
                status_kind=job.status.kind.value,
                created_at=job.created_at.toIso(),
            )
            for job in paginated_jobs
        )

        dto = ListJobsDto(jobs=job_summaries, total_count=len(all_jobs))

        return Success(value=dto)
