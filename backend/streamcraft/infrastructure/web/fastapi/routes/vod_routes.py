"""FastAPI routes for VOD operations."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from streamcraft.application.vod.fetch_vod_metadata import FetchVodMetadataCommand, FetchVodMetadataHandler
from streamcraft.domain.shared.branded_types import create_vod_id
from streamcraft.domain.vod.value_objects.platform import Platform
from streamcraft.infrastructure.web.fastapi.dependencies import get_fetch_vod_metadata_handler

router = APIRouter(prefix="/vods", tags=["vods"])


class FetchVodMetadataRequest(BaseModel):
    """Request model for fetching VOD metadata."""

    vod_id: str
    platform: str


class FetchVodMetadataResponse(BaseModel):
    """Response model for fetched VOD metadata."""

    vod_id: str
    streamer: str
    title: str
    duration_seconds: float
    preview_url: str | None
    platform: str


@router.post("/metadata", response_model=FetchVodMetadataResponse)
def fetch_vod_metadata(
    request: FetchVodMetadataRequest,
    handler: Annotated[FetchVodMetadataHandler, Depends(get_fetch_vod_metadata_handler)],
) -> FetchVodMetadataResponse:
    """Fetch VOD metadata from external API."""
    try:
        platform = Platform(request.platform.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {request.platform}")

    command = FetchVodMetadataCommand(vod_id=create_vod_id(request.vod_id), platform=platform)
    result = handler.execute(command)

    if result.is_failure():
        error = result.unwrap_error()
        raise HTTPException(status_code=500, detail=str(error))

    dto = result.unwrap()

    return FetchVodMetadataResponse(
        vod_id=dto.vod_id,
        streamer=dto.streamer,
        title=dto.title,
        duration_seconds=dto.duration_seconds,
        preview_url=dto.preview_url,
        platform=dto.platform,
    )
