"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from streamcraft.infrastructure.web.fastapi.routes import (
    audio_router,
    dataset_router,
    job_extended_router,
    job_router,
    transcription_router,
    vod_router,
)
from streamcraft.api import routes as legacy_routes


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="Streamcraft TTS API",
        description="Ultra-typed clean architecture API for TTS dataset creation",
        version="2.0.0",
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
    app.include_router(legacy_routes.router, prefix="/api/legacy")

    # Health check endpoint
    @app.get("/health")
    def health() -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "ok"}

    return app


# Create app instance
app = create_app()
