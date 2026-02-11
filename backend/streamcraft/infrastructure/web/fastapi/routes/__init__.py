"""FastAPI routes."""

from streamcraft.infrastructure.web.fastapi.routes.audio_routes import router as audio_router
from streamcraft.infrastructure.web.fastapi.routes.dataset_routes import router as dataset_router
from streamcraft.infrastructure.web.fastapi.routes.job_routes import router as job_router
from streamcraft.infrastructure.web.fastapi.routes.job_routes_extended import (
    router as job_extended_router,
)
from streamcraft.infrastructure.web.fastapi.routes.run_routes import router as run_router
from streamcraft.infrastructure.web.fastapi.routes.transcription_routes import router as transcription_router
from streamcraft.infrastructure.web.fastapi.routes.vod_routes import router as vod_router

__all__ = [
    "audio_router",
    "dataset_router",
    "job_router",
    "job_extended_router",
    "run_router",
    "transcription_router",
    "vod_router",
]
