"""
Retry Job Use Case - Handler
"""

from ....domain.job.errors import JobNotFoundError
from ....domain.job.ports import JobRepository
from ....domain.shared.result import Result, Err, Ok
from .command import RetryJobCommand
from .dto import RetryJobDto


class RetryJobHandler:
    """Handler for retrying a failed job."""

    def __init__(self, job_repository: JobRepository) -> None:
        self._job_repository = job_repository

    async def execute(
        self, command: RetryJobCommand
    ) -> Result[RetryJobDto, JobNotFoundError]:
        """Execute the retry job use case."""
        # Find job
        job_result = await self._job_repository.find_by_id(command.job_id)
        if isinstance(job_result, Err):
            return job_result

        job = job_result.value
        status = job.get_status()

        # Store previous error message
        previous_error = status.error_message or "No error message"

        # Only retry if job is in error state
        if status.kind != "error":
            return Err(
                JobNotFoundError(
                    f"Job {command.job_id} is not in error state, cannot retry"
                )
            )

        # Reset job by starting the specified step
        job.start_step(command.from_step)

        # Save updated job
        save_result = await self._job_repository.save(job)
        if isinstance(save_result, Err):
            return Err(JobNotFoundError(f"Failed to save job: {save_result.error}"))

        # Get updated status
        updated_status = job.get_status()

        # Create DTO
        dto = RetryJobDto(
            job_id=job.get_id(),
            vod_url=job.get_vod_url(),
            status=updated_status.kind,
            current_step=updated_status.current_step or command.from_step,
            previous_error=previous_error,
            retry_from_step=command.from_step,
        )

        return Ok(dto)
