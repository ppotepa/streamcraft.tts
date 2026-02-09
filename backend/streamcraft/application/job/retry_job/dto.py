"""
Retry Job Use Case - DTO
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class RetryJobDto:
    """DTO for retried job result."""

    job_id: str
    vod_url: str
    status: str
    current_step: str
    previous_error: str
    retry_from_step: str
