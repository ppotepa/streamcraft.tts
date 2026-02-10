"""
Cancel Job Use Case - Command
"""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True)
class CancelJobCommand:
    """Command to cancel a running job."""

    job_id: JobId
    reason: str = "Cancelled by user"
