"""Create job use case handler."""

import uuid
from typing import Union

from streamcraft.application.job.create_job.command import CreateJobCommand
from streamcraft.application.job.create_job.dto import CreateJobDto
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.job.entities.job import create_job
from streamcraft.domain.job.ports.job_repository import JobRepository
from streamcraft.domain.shared.branded_types import JobId, VodId, create_job_id, create_vod_id
from streamcraft.domain.shared.result import Failure, Result, Success
from streamcraft.domain.vod.errors.vod_errors import InvalidVodUrlError
from streamcraft.domain.vod.value_objects.vod_url import VodUrl


class CreateJobHandler(UseCase[CreateJobCommand, CreateJobDto, Exception]):
    """Handler for creating jobs."""

    def __init__(self, job_repository: JobRepository) -> None:
        """Initialize handler with dependencies."""
        self._job_repository = job_repository

    def execute(self, request: CreateJobCommand) -> Result[CreateJobDto, Exception]:
        """Execute the create job command."""
        # Validate VOD URL
        try:
            vod_url = VodUrl.from_string(request.vod_url)
        except InvalidVodUrlError as e:
            return Failure(e)

        # Extract VOD ID
        vod_id_str = vod_url.extract_id()
        vod_id = create_vod_id(vod_id_str)

        # Create job ID
        job_id = create_job_id(str(uuid.uuid4()))

        # Create job entity
        job = create_job(job_id=job_id, vod_id=vod_id, vod_url=request.vod_url)

        # Save job
        save_result = self._job_repository.save(job)
        if isinstance(save_result, Failure):
            return Failure(save_result.error)

        saved_job = save_result.unwrap()

        # Map to DTO
        dto = CreateJobDto(
            job_id=str(saved_job.id),
            vod_id=str(saved_job.vod_id),
            vod_url=saved_job.vod_url,
            status=str(saved_job.status.kind.value),
            created_at=saved_job.created_at.to_iso(),
        )

        return Success(dto)
