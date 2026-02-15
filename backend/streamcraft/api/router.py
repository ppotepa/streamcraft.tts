"""API router composition root."""

from fastapi import APIRouter

from streamcraft.api.routes import router as legacy_compat_router

api_router = APIRouter()
api_router.include_router(legacy_compat_router)
