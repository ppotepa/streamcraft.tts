"""Result type for explicit error handling without exceptions.

Result[T, E] represents either success with value T or failure with error E.
This makes error handling explicit and forces consumers to handle both cases.
"""

from dataclasses import dataclass
from typing import Callable, Generic, TypeVar


T = TypeVar("T")
E = TypeVar("E")
U = TypeVar("U")
F = TypeVar("F")


@dataclass(frozen=True, slots=True)
class Success(Generic[T]):
    """Represents a successful operation with a value."""

    value: T

    def is_success(self) -> bool:
        """Check if this is a success."""
        return True

    def is_failure(self) -> bool:
        """Check if this is a failure."""
        return False

    def map(self, func: Callable[[T], U]) -> "Result[U, E]":
        """Map the success value to a new value."""
        return Success(func(self.value))

    def map_error(self, func: Callable[[E], F]) -> "Result[T, F]":
        """Map operation does nothing for Success."""
        return Success(self.value)  # type: ignore[return-value]

    def and_then(self, func: Callable[[T], "Result[U, E]"]) -> "Result[U, E]":
        """Chain operations that return Results."""
        return func(self.value)

    def unwrap(self) -> T:
        """Get the value, safe because this is Success."""
        return self.value

    def unwrap_or(self, default: T) -> T:
        """Get the value or default."""
        return self.value

    def unwrap_or_else(self, func: Callable[[E], T]) -> T:
        """Get the value or compute from error."""
        return self.value


@dataclass(frozen=True, slots=True)
class Failure(Generic[E]):
    """Represents a failed operation with an error."""

    error: E

    def is_success(self) -> bool:
        """Check if this is a success."""
        return False

    def is_failure(self) -> bool:
        """Check if this is a failure."""
        return True

    def map(self, func: Callable[[T], U]) -> "Result[U, E]":
        """Map operation does nothing for Failure."""
        return Failure(self.error)  # type: ignore[return-value]

    def map_error(self, func: Callable[[E], F]) -> "Result[T, F]":
        """Map the error to a new error type."""
        return Failure(func(self.error))

    def and_then(self, func: Callable[[T], "Result[U, E]"]) -> "Result[U, E]":
        """Chain operation does nothing for Failure."""
        return Failure(self.error)  # type: ignore[return-value]

    def unwrap(self) -> T:
        """Raises an exception - should not be called on Failure."""
        raise ValueError(f"Called unwrap on Failure: {self.error}")

    def unwrap_or(self, default: T) -> T:
        """Get the default value."""
        return default

    def unwrap_or_else(self, func: Callable[[E], T]) -> T:
        """Compute value from error."""
        return func(self.error)


Result = Success[T] | Failure[E]

# Backwards-compatible aliases for existing call sites
Ok = Success
Err = Failure


def ok(value: T) -> Success[T]:
    """Create a Success result."""
    return Success(value)


def err(error: E) -> Failure[E]:
    """Create a Failure result."""
    return Failure(error)
