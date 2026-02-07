"""Centralized filesystem locations for jobs, datasets, and outputs.

This keeps the wizard/API and existing scripts aligned on where artifacts
are stored. Paths are resolved relative to the repo root (two levels up
from this file).
"""

from pathlib import Path


# Repo root inferred from this file location
BASE_DIR = Path(__file__).resolve().parent.parent

# Top-level buckets
JOBS_DIR = BASE_DIR / "jobs"
DATASETS_DIR = BASE_DIR / "datasets"
OUTPUT_DIR = BASE_DIR / "output"

# Sub-folders under jobs and output
RAW_JOBS_DIR = JOBS_DIR / "raw"
JOBS_LOGS_DIR = JOBS_DIR / "logs"
JOBS_CACHE_DIR = JOBS_DIR / "cache"
OUTPUT_TTS_DIR = OUTPUT_DIR / "tts"
OUTPUT_REPORTS_DIR = OUTPUT_DIR / "reports"


def ensure_base_dirs() -> None:
    """Create required folders if they do not exist."""

    for path in (
        JOBS_DIR,
        RAW_JOBS_DIR,
        JOBS_LOGS_DIR,
        JOBS_CACHE_DIR,
        DATASETS_DIR,
        OUTPUT_DIR,
        OUTPUT_TTS_DIR,
        OUTPUT_REPORTS_DIR,
    ):
        path.mkdir(parents=True, exist_ok=True)


__all__ = [
    "BASE_DIR",
    "JOBS_DIR",
    "RAW_JOBS_DIR",
    "JOBS_LOGS_DIR",
    "JOBS_CACHE_DIR",
    "DATASETS_DIR",
    "OUTPUT_DIR",
    "OUTPUT_TTS_DIR",
    "OUTPUT_REPORTS_DIR",
    "ensure_base_dirs",
]