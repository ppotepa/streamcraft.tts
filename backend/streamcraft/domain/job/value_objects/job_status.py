"""Job status value object with discriminated union pattern."""

from dataclasses import dataclass
from enum import Enum
from typing import Literal


class JobStatusKind(str, Enum):
    """Job status kinds."""

    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class IdleStatus:
    """Job is idle and ready to start."""

    kind: Literal[JobStatusKind.IDLE] = JobStatusKind.IDLE


@dataclass(frozen=True, slots=True)
class RunningStatus:
    """Job is currently running."""

    kind: Literal[JobStatusKind.RUNNING] = JobStatusKind.RUNNING
    current_step: str
    progress: float  # 0.0 to 1.0

    def __post_init__(self) -> None:
        """Validate progress."""
        if not 0.0 <= self.progress <= 1.0:
            raise ValueError("Progress must be between 0.0 and 1.0")


@dataclass(frozen=True, slots=True)
class DoneStatus:
    """Job completed successfully."""

    kind: Literal[JobStatusKind.DONE] = JobStatusKind.DONE
    exit_code: int


@dataclass(frozen=True, slots=True)
class ErrorStatus:
    """Job failed with an error."""

    kind: Literal[JobStatusKind.ERROR] = JobStatusKind.ERROR
    message: str
    exit_code: int


JobStatus = IdleStatus | RunningStatus | DoneStatus | ErrorStatus


def create_idle() -> IdleStatus:
    """Create an idle status."""
    return IdleStatus()


def create_running(current_step: str, progress: float) -> RunningStatus:
    """Create a running status."""
    return RunningStatus(current_step=current_step, progress=progress)


def create_done(exit_code: int) -> DoneStatus:
    """Create a done status."""
    return DoneStatus(exit_code=exit_code)


def create_error(message: str, exit_code: int) -> ErrorStatus:
    """Create an error status."""
    return ErrorStatus(message=message, exit_code=exit_code)
