"""Modular API routes package.

Compatibility note:
- Routes are registered in modular files and mounted under `/api/legacy`.
"""

from fastapi import APIRouter

from streamcraft.api.routes.artifact import router as artifact_router
from streamcraft.api.routes.audio import router as audio_router
from streamcraft.api.routes.asr import router as asr_router
from streamcraft.api.routes.dataset import router as dataset_router
from streamcraft.api.routes.diarization import router as diarization_router
from streamcraft.api.routes.jobs import router as jobs_router
from streamcraft.api.routes.model_train import router as model_train_router
from streamcraft.api.routes.sanitize import router as sanitize_router
from streamcraft.api.routes.tts import router as tts_router
from streamcraft.api.routes.vod import router as vod_router

router = APIRouter()
router.include_router(sanitize_router)
router.include_router(asr_router)
router.include_router(vod_router)
router.include_router(audio_router)
router.include_router(diarization_router)
router.include_router(dataset_router)
router.include_router(model_train_router)
router.include_router(tts_router)
router.include_router(jobs_router)
router.include_router(artifact_router)

__all__ = ["router"]
