"""Centralized filesystem locations for jobs, datasets, and outputs."""

from pathlib import Path
from typing import Optional


class Paths:
    """Centralized path resolver."""
    
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path.cwd()
        
        # Top-level buckets
        self.jobs_dir = self.base_dir / "jobs"
        self.datasets_dir = self.base_dir / "dataset"
        self.output_dir = self.base_dir / "out"
        self.temp_dir = self.base_dir / "temp"
        
        # Sub-folders
        self.jobs_logs_dir = self.jobs_dir / "logs"
        self.jobs_cache_dir = self.jobs_dir / "cache"
        self.cache_dir = self.temp_dir / "cache"
        
    def ensure_base_dirs(self) -> None:
        """Create required folders if they do not exist."""
        for path in (
            self.jobs_dir,
            self.jobs_logs_dir,
            self.jobs_cache_dir,
            self.datasets_dir,
            self.output_dir,
            self.temp_dir,
            self.cache_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)
    
    def vod_dir(self, streamer: str, vod_id: str) -> Path:
        """Return output directory for a specific VOD."""
        return self.output_dir / streamer / "vods" / vod_id
    
    def dataset_dir(self, streamer: str) -> Path:
        """Return dataset directory for a specific streamer."""
        return self.datasets_dir / streamer


# Default global instance
_default_paths: Optional[Paths] = None


def get_paths(base_dir: Optional[Path] = None) -> Paths:
    """Get or create the default Paths instance."""
    global _default_paths
    if _default_paths is None or base_dir is not None:
        _default_paths = Paths(base_dir)
    return _default_paths
