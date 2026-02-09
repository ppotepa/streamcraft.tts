"""
Cancel Job Use Case - DTO
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CancelJobDto:
    """DTO for cancelled job result."""

    job_id: str
    vod_url: str
    status: str  # Should be "error"
    current_step: str
    error_message: str
    was_running: bool
