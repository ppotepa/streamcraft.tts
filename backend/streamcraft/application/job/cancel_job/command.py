"""
Cancel Job Use Case - Command
"""

from dataclasses import dataclass

from ...domain.job.value_objects import JobId


@dataclass(frozen=True)
class CancelJobCommand:
    """Command to cancel a running job."""

    job_id: JobId
    reason: str = "Cancelled by user"
