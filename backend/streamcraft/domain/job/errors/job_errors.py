"""Job domain errors."""

from dataclasses import dataclass

from streamcraft.domain.shared.errors import DomainError, InvalidStateError, NotFoundError


@dataclass(frozen=True, slots=True)
class JobNotFoundError(NotFoundError):
    """Error when a job is not found."""

    def __init__(self, job_id: str) -> None:
        """Initialize job not found error."""
        super().__init__(entity_type="Job", entity_id=job_id)


@dataclass(frozen=True, slots=True)
class StepFailedError(DomainError):
    """Error when a job step fails."""

    step_name: str
    exit_code: int
    details: str

    def __init__(self, step_name: str, exit_code: int, details: str) -> None:
        """Initialize step failed error."""
        object.__setattr__(self, "step_name", step_name)
        object.__setattr__(self, "exit_code", exit_code)
        object.__setattr__(self, "details", details)
        object.__setattr__(
            self, "message", f"Step '{step_name}' failed with code {exit_code}: {details}"
        )
        object.__setattr__(self, "code", "STEP_FAILED")


@dataclass(frozen=True, slots=True)
class InvalidJobTransitionError(InvalidStateError):
    """Error when attempting an invalid job state transition."""

    def __init__(self, current_state: str, attempted_transition: str) -> None:
        """Initialize invalid transition error."""
        super().__init__(
            current_state=current_state, attempted_action=f"transition to {attempted_transition}"
        )
        object.__setattr__(self, "code", "INVALID_JOB_TRANSITION")
