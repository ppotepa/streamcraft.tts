"""FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from streamcraft.api import routes
from streamcraft.settings import get_settings

settings = get_settings()

app = FastAPI(
    title="Streamcraft TTS API",
    version="0.1.0",
    description="Backend API for the Streamcraft TTS wizard",
)

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(routes.router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Streamcraft TTS API", "version": "0.1.0"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
