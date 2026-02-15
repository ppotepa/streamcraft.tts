"""Artifact file endpoints."""

from fastapi import APIRouter, Query

from streamcraft.api.routes import artifact_handlers as route_impl

router = APIRouter()


@router.api_route("/artifact", methods=["GET", "HEAD"])
async def get_artifact(path: str = Query(..., description="Relative path to fetch under workspace")):
    return await route_impl.get_artifact(path=path)
