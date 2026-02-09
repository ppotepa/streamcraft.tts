"""
Memory-based repository for datasets (testing/development).
"""

from typing import Dict, Optional
from streamcraft.domain.dataset.entities.dataset import Dataset
from streamcraft.domain.dataset.ports.dataset_repository import DatasetRepository
from streamcraft.domain.shared.branded_types import DatasetId
from streamcraft.domain.shared.result import Result, Success, Failure


class MemoryDatasetRepository(DatasetRepository):
    """In-memory implementation of DatasetRepository for testing."""

    def __init__(self) -> None:
        """Initialize empty in-memory storage."""
        self._storage: Dict[DatasetId, Dataset] = {}

    async def save(self, dataset: Dataset) -> Result[Dataset, Exception]:
        """Save dataset to memory."""
        try:
            self._storage[dataset.dataset_id] = dataset
            return Success(dataset)
        except Exception as e:
            return Failure(e)

    async def find_by_id(self, dataset_id: DatasetId) -> Result[Optional[Dataset], Exception]:
        """Find dataset by ID in memory."""
        try:
            dataset = self._storage.get(dataset_id)
            return Success(dataset)
        except Exception as e:
            return Failure(e)

    async def find_all(self) -> Result[list[Dataset], Exception]:
        """Find all datasets in memory."""
        try:
            datasets = list(self._storage.values())
            return Success(datasets)
        except Exception as e:
            return Failure(e)

    async def delete(self, dataset_id: DatasetId) -> Result[bool, Exception]:
        """Delete dataset from memory."""
        try:
            if dataset_id in self._storage:
                del self._storage[dataset_id]
                return Success(True)
            return Success(False)
        except Exception as e:
            return Failure(e)

    def clear(self) -> None:
        """Clear all datasets (useful for testing)."""
        self._storage.clear()
