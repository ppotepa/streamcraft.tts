"""
FastAPI routes for Dataset domain
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from streamcraft.application.dataset.create_dataset import CreateDatasetHandler
from streamcraft.application.dataset.export_dataset import ExportDatasetHandler
from streamcraft.application.dataset.split_dataset import SplitDatasetHandler
from streamcraft.application.dataset.validate_dataset import ValidateDatasetHandler
from streamcraft.domain.shared.result import Failure
from streamcraft.infrastructure.web.fastapi.dependencies import (
    get_create_dataset_handler,
    get_validate_dataset_handler,
    get_export_dataset_handler,
    get_split_dataset_handler,
)


router = APIRouter(prefix="/datasets", tags=["datasets"])


# Request models
class DatasetEntryInput(BaseModel):
    audio_path: str
    text: str
    duration_seconds: Optional[float] = None


class CreateDatasetRequest(BaseModel):
    name: str
    entries: list[DatasetEntryInput]


class ValidateDatasetRequest(BaseModel):
    dataset_id: str


class ExportDatasetRequest(BaseModel):
    dataset_id: str
    output_path: str
    format: str  # "json", "csv", "jsonl"


class SplitDatasetRequest(BaseModel):
    dataset_id: str
    train_ratio: float = 0.8
    validation_ratio: float = 0.1
    test_ratio: float = 0.1
    shuffle: bool = True
    random_seed: Optional[int] = None


# Dependency injection placeholders
# NOTE: These are now defined in dependencies.py and imported via Depends


# Routes
@router.post("/")
async def create_dataset(
    request: CreateDatasetRequest,
    handler: CreateDatasetHandler = Depends(get_create_dataset_handler),
):
    """Create a new dataset."""
    from streamcraft.application.dataset.create_dataset import CreateDatasetCommand, DatasetEntryInput as EntryInput

    entries = [
        EntryInput(
            audio_path=e.audio_path,
            text=e.text,
            duration_seconds=e.duration_seconds,
        )
        for e in request.entries
    ]

    command = CreateDatasetCommand(name=request.name, entries=entries)
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=400, detail=str(result.unwrap_error()))

    return result.unwrap()


@router.post("/{dataset_id}/validate")
async def validate_dataset(
    dataset_id: str,
    handler: ValidateDatasetHandler = Depends(get_validate_dataset_handler),
):
    """Validate dataset entries."""
    from streamcraft.application.dataset.validate_dataset import ValidateDatasetCommand

    command = ValidateDatasetCommand(dataset_id=dataset_id)
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=404, detail=str(result.unwrap_error()))

    return result.unwrap()


@router.post("/{dataset_id}/export")
async def export_dataset(
    dataset_id: str,
    request: ExportDatasetRequest,
    handler: ExportDatasetHandler = Depends(get_export_dataset_handler),
):
    """Export dataset to file."""
    from streamcraft.application.dataset.export_dataset import ExportDatasetCommand

    command = ExportDatasetCommand(
        dataset_id=dataset_id,
        output_path=request.output_path,
        format=request.format,
    )
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=404, detail=str(result.unwrap_error()))

    return result.unwrap()


@router.post("/{dataset_id}/split")
async def split_dataset(
    dataset_id: str,
    request: SplitDatasetRequest,
    handler: SplitDatasetHandler = Depends(get_split_dataset_handler),
):
    """Split dataset into train/validation/test sets."""
    from streamcraft.application.dataset.split_dataset import SplitDatasetCommand

    command = SplitDatasetCommand(
        dataset_id=dataset_id,
        train_ratio=request.train_ratio,
        validation_ratio=request.validation_ratio,
        test_ratio=request.test_ratio,
        shuffle=request.shuffle,
        random_seed=request.random_seed,
    )
    result = handler.execute(command)

    if result.is_failure():
        raise HTTPException(status_code=404, detail=str(result.unwrap_error()))

    return result.unwrap()
