"""
Retry Job Use Case - Command
"""

from dataclasses import dataclass

from streamcraft.domain.shared.branded_types import JobId


@dataclass(frozen=True)
class RetryJobCommand:
    """Command to retry a failed job."""

    job_id: JobId
    from_step: str = "download_vod"  # Default to start from beginning
