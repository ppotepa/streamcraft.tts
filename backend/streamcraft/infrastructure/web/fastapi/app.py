"""FastAPI application factory."""

import os
import platform
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from streamcraft.infrastructure.web.fastapi.routes import (
    audio_router,
    dataset_router,
    job_extended_router,
    job_router,
    run_router,
    transcription_router,
    vod_router,
)
from streamcraft.api.routes import router as legacy_compat_router


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    exe = sys.executable
    py_ver = platform.python_version()
    venv = os.environ.get("VIRTUAL_ENV") or "(not set)"
    print(f"[self-check] python={exe}")
    print(f"[self-check] python_version={py_ver} virtual_env={venv}")

    fw_version = "unavailable"
    try:
        import faster_whisper

        fw_version = getattr(faster_whisper, "__version__", "unknown")
    except Exception as exc:
        print(f"[self-check] faster_whisper=unavailable reason={exc}")

    try:
        import ctranslate2

        ct2_ver = getattr(ctranslate2, "__version__", "unknown")
        if hasattr(ctranslate2, "get_cuda_device_count"):
            cuda_count = ctranslate2.get_cuda_device_count()
            cuda_ready = cuda_count > 0
        elif hasattr(ctranslate2, "has_cuda"):
            cuda_ready = bool(ctranslate2.has_cuda())
            cuda_count = "unknown"
        else:
            cuda_ready = False
            cuda_count = "unknown"

        print(
            f"[self-check] ctranslate2={ct2_ver} faster_whisper={fw_version} "
            f"cuda_ready={cuda_ready} cuda_count={cuda_count}"
        )
    except Exception as exc:
        print(f"[self-check] ctranslate2=unavailable faster_whisper={fw_version} reason={exc}")

    yield


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="Streamcraft TTS API",
        description="Ultra-typed clean architecture API for TTS dataset creation",
        version="2.0.0",
        lifespan=_lifespan,
    )

    # Configure CORS for frontend communication
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],  # Frontend dev server
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers with /api prefix
    app.include_router(job_router, prefix="/api")
    app.include_router(job_extended_router, prefix="/api")
    app.include_router(vod_router, prefix="/api")
    app.include_router(audio_router, prefix="/api")
    app.include_router(transcription_router, prefix="/api")
    app.include_router(dataset_router, prefix="/api")
    app.include_router(run_router, prefix="/api")
    app.include_router(legacy_compat_router, prefix="/api/legacy")

    # Health check endpoint
    @app.get("/health")
    def health() -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "ok"}

    return app


# Create app instance
app = create_app()
