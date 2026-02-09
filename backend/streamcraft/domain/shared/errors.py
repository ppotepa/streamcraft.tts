"""Base domain error classes.

All domain errors inherit from DomainError to maintain type hierarchy.
Each error is explicit and carries meaningful information.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class DomainError:
    """Base class for all domain errors."""

    message: str
    code: str

    def __str__(self) -> str:
        """String representation of the error."""
        return f"[{self.code}] {self.message}"


@dataclass(frozen=True, slots=True)
class ValidationError(DomainError):
    """Error for validation failures."""

    field: str
    value: Any

    def __init__(self, field: str, value: Any, message: str) -> None:
        """Initialize validation error."""
        object.__setattr__(self, "field", field)
        object.__setattr__(self, "value", value)
        object.__setattr__(self, "message", message)
        object.__setattr__(self, "code", "VALIDATION_ERROR")


@dataclass(frozen=True, slots=True)
class NotFoundError(DomainError):
    """Error when an entity is not found."""

    entity_type: str
    entity_id: str

    def __init__(self, entity_type: str, entity_id: str) -> None:
        """Initialize not found error."""
        object.__setattr__(self, "entity_type", entity_type)
        object.__setattr__(self, "entity_id", entity_id)
        object.__setattr__(self, "message", f"{entity_type} with id '{entity_id}' not found")
        object.__setattr__(self, "code", "NOT_FOUND")


@dataclass(frozen=True, slots=True)
class InvalidStateError(DomainError):
    """Error when an operation is invalid for current state."""

    current_state: str
    attempted_action: str

    def __init__(self, current_state: str, attempted_action: str) -> None:
        """Initialize invalid state error."""
        object.__setattr__(self, "current_state", current_state)
        object.__setattr__(self, "attempted_action", attempted_action)
        object.__setattr__(
            self, "message", f"Cannot {attempted_action} in state {current_state}"
        )
        object.__setattr__(self, "code", "INVALID_STATE")
