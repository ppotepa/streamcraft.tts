"""List jobs use case command."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ListJobsCommand:
    """Command to list all jobs."""

    limit: int | None = None
    offset: int = 0
