"""FastAPI web infrastructure."""

from streamcraft.infrastructure.web.fastapi.app import app, create_app
from streamcraft.infrastructure.web.fastapi.dependencies import (
    get_analyze_audio_quality_handler,
    get_create_job_handler,
    get_extract_audio_handler,
    get_fetch_vod_metadata_handler,
    get_get_job_status_handler,
    get_job_repository,
    get_list_jobs_handler,
    get_start_job_step_handler,
)
from streamcraft.infrastructure.web.fastapi.routes import (
    audio_router,
    job_extended_router,
    job_router,
    vod_router,
)

__all__ = [
    "app",
    "create_app",
    "get_analyze_audio_quality_handler",
    "get_create_job_handler",
    "get_extract_audio_handler",
    "get_fetch_vod_metadata_handler",
    "get_get_job_status_handler",
    "get_job_repository",
    "get_list_jobs_handler",
    "get_start_job_step_handler",
    "audio_router",
    "job_extended_router",
    "job_router",
    "vod_router",
]
