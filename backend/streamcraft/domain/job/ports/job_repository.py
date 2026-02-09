"""Job repository port - defines contract for job persistence."""

from abc import ABC, abstractmethod
from typing import Sequence

from streamcraft.domain.job.entities.job import Job
from streamcraft.domain.job.errors.job_errors import JobNotFoundError
from streamcraft.domain.shared.branded_types import JobId
from streamcraft.domain.shared.result import Result


class JobRepository(ABC):
    """Port for job persistence operations."""

    @abstractmethod
    def save(self, job: Job) -> Result[Job, Exception]:
        """Save a job."""
        ...

    @abstractmethod
    def find_by_id(self, job_id: JobId) -> Result[Job, JobNotFoundError]:
        """Find a job by ID."""
        ...

    @abstractmethod
    def find_all(self) -> Result[Sequence[Job], Exception]:
        """Find all jobs."""
        ...

    @abstractmethod
    def delete(self, job_id: JobId) -> Result[None, JobNotFoundError]:
        """Delete a job."""
        ...
