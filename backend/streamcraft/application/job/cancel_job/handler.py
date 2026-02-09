"""
Cancel Job Use Case - Handler
"""

from ....domain.job.errors import JobNotFoundError
from ....domain.job.ports import JobRepository
from ....domain.shared.result import Result, Err, Ok
from .command import CancelJobCommand
from .dto import CancelJobDto


class CancelJobHandler:
    """Handler for cancelling a job."""

    def __init__(self, job_repository: JobRepository) -> None:
        self._job_repository = job_repository

    async def execute(
        self, command: CancelJobCommand
    ) -> Result[CancelJobDto, JobNotFoundError]:
        """Execute the cancel job use case."""
        # Find job
        job_result = await self._job_repository.find_by_id(command.job_id)
        if isinstance(job_result, Err):
            return job_result

        job = job_result.value
        status = job.get_status()
        was_running = status.kind == "running"

        # Cancel by failing current step
        if was_running:
            current_step = status.current_step or "unknown"
            job.fail_step(current_step, command.reason)
        else:
            # If not running, just mark as error
            job.fail_step("none", command.reason)

        # Save updated job
        save_result = await self._job_repository.save(job)
        if isinstance(save_result, Err):
            return Err(JobNotFoundError(f"Failed to save job: {save_result.error}"))

        # Get updated status
        updated_status = job.get_status()

        # Create DTO
        dto = CancelJobDto(
            job_id=job.get_id(),
            vod_url=job.get_vod_url(),
            status=updated_status.kind,
            current_step=status.current_step or "none",
            error_message=command.reason,
            was_running=was_running,
        )

        return Ok(dto)
