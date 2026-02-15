"""VOD endpoints."""

from fastapi import APIRouter

from streamcraft.api.routes import vod_handlers as route_impl
from streamcraft.models.api import VodMetaResponse

router = APIRouter()


@router.post("/vod/check")
async def check_vod(vod_url: str) -> VodMetaResponse:
    return await route_impl.check_vod(vod_url=vod_url)
