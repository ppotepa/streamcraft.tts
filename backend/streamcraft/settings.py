"""Application settings."""

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Global configuration."""
    
    # Paths
    base_dir: Path = Path.cwd()
    
    # API
    api_host: str = "127.0.0.1"
    api_port: int = 8010
    
    # Transcription defaults
    whisper_model: str = "large-v3"
    whisper_language: str = "en"
    whisper_threads: int = 8
    whisper_compute_type: str = "float16"
    vod_quality: str = "audio_only"
    
    # Dataset defaults
    min_speech_ms: int = 1500
    max_clip_sec: int = 12
    pad_ms: int = 150
    merge_gap_ms: int = 300
    clip_aac_bitrate: int = 320
    use_demucs: bool = False
    
    # External API credentials
    twitch_client_id: str = ""
    twitch_client_secret: str = ""
    youtube_api_key: str = ""
    
    class Config:
        env_prefix = "STREAMCRAFT_"
        case_sensitive = False
        env_file = ".env"
        env_file_encoding = "utf-8"


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get or create the singleton settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
