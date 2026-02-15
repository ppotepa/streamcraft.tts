"""Dataset endpoints."""

from fastapi import APIRouter, Query

from streamcraft.api.routes import dataset_handlers as route_impl
from streamcraft.models.api import (
    DatasetListResponse,
    DatasetRecordResponse,
    RunTrainRequest,
    RunTrainResponse,
    StreamerDatasetSummaryListResponse,
)

router = APIRouter()


@router.post("/dataset/build")
async def run_dataset_build(request: RunTrainRequest) -> RunTrainResponse:
    return await route_impl.run_dataset_build(request)


@router.get("/datasets/streamers", response_model=StreamerDatasetSummaryListResponse)
async def list_dataset_streamers(
    datasetOut: str = Query("dataset"),
    outdir: str = Query("out"),
    refresh: bool = Query(False),
):
    return await route_impl.list_dataset_streamers(datasetOut=datasetOut, outdir=outdir, refresh=refresh)


@router.get("/datasets", response_model=DatasetListResponse)
async def list_datasets(
    streamer: str | None = Query(None),
    datasetOut: str = Query("dataset"),
    outdir: str = Query("out"),
    refresh: bool = Query(False),
):
    return await route_impl.list_datasets(streamer=streamer, datasetOut=datasetOut, outdir=outdir, refresh=refresh)


@router.get("/datasets/{dataset_id}", response_model=DatasetRecordResponse)
async def get_dataset_record(
    dataset_id: str,
    datasetOut: str = Query("dataset"),
    outdir: str = Query("out"),
    refresh: bool = Query(False),
):
    return await route_impl.get_dataset_record(dataset_id=dataset_id, datasetOut=datasetOut, outdir=outdir, refresh=refresh)
