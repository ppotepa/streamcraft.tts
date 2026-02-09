"""Application layer use case base."""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from streamcraft.domain.shared.result import Result


TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")
TError = TypeVar("TError", bound=Exception)


class UseCase(ABC, Generic[TInput, TOutput, TError]):
    """Base class for all use cases."""

    @abstractmethod
    def execute(self, request: TInput) -> Result[TOutput, TError]:
        """Execute the use case."""
        ...
