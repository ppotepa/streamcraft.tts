"""Compatibility re-export module for route handlers.

This module keeps legacy imports working while handler implementations
live in dedicated domain modules.
"""

from streamcraft.api.routes.artifact_handlers import get_artifact, resolve_artifact_path
from streamcraft.api.routes.asr_handlers import run_srt, transcribe_segment
from streamcraft.api.routes.audio_handlers import run_audio
from streamcraft.api.routes.dataset_handlers import (
    get_dataset_record,
    list_dataset_streamers,
    list_datasets,
    run_dataset_build,
)
from streamcraft.api.routes.diarization_handlers import run_diarization
from streamcraft.api.routes.jobs_handlers import create_job, delete_job, get_job, get_jobs, purge_job, update_job
from streamcraft.api.routes.model_train_handlers import (
    cancel_model_train_job,
    get_model_train_job,
    list_model_train_jobs,
    retry_model_train_job,
    run_model_train,
)
from streamcraft.api.routes.tts_handlers import run_tts
from streamcraft.api.routes.vod_handlers import check_vod

__all__ = [
    "check_vod",
    "run_audio",
    "run_diarization",
    "run_dataset_build",
    "run_model_train",
    "list_model_train_jobs",
    "get_model_train_job",
    "cancel_model_train_job",
    "retry_model_train_job",
    "run_srt",
    "transcribe_segment",
    "run_tts",
    "list_dataset_streamers",
    "list_datasets",
    "get_dataset_record",
    "create_job",
    "get_jobs",
    "get_job",
    "update_job",
    "delete_job",
    "purge_job",
    "resolve_artifact_path",
    "get_artifact",
]
