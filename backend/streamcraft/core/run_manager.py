"""Run metadata management for multi-run VOD state persistence."""

import json
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class RunStatus(str, Enum):
    """Status of a sanitization run."""
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass
class RunParams:
    """Parameters used for a sanitization run."""
    mode: str
    preset: str
    strictness: float
    extract_vocals: bool
    preserve_pauses: bool
    reduce_sfx: bool
    target_lufs: float
    true_peak_limit_db: float
    fade_ms: int
    voice_sample_count: Optional[int] = None
    voice_sample_min_duration: Optional[float] = None
    voice_sample_max_duration: Optional[float] = None
    voice_sample_min_rms_db: Optional[float] = None


@dataclass
class RunStats:
    """Statistics for a sanitization run."""
    total_segments: int
    kept_segments: int
    total_duration: float
    clean_duration: float
    rejection_reasons: Optional[Dict[str, int]] = None


@dataclass
class RunMetadata:
    """Complete metadata for a sanitization run."""
    run_id: str
    created_at: str
    vod_url: str
    streamer: str
    vod_identifier: Optional[str]
    status: RunStatus
    params: RunParams
    stats: Optional[RunStats] = None
    segments_manifest: Optional[str] = None
    clean_audio: Optional[str] = None
    error_message: Optional[str] = None
    completed_at: Optional[str] = None


def save_run_metadata(dataset_dir: Path, metadata: RunMetadata) -> Path:
    """
    Save run metadata to JSON file.
    
    Args:
        dataset_dir: Dataset directory for this run (includes run_id in path)
        metadata: Run metadata to save
    
    Returns:
        Path to the saved metadata file
    """
    dataset_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = dataset_dir / "run_metadata.json"
    
    # Convert to dict, handling enums and dataclasses
    data = asdict(metadata)
    data["status"] = metadata.status.value
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return metadata_path


def load_run_metadata(dataset_dir: Path) -> Optional[RunMetadata]:
    """
    Load run metadata from JSON file.
    
    Args:
        dataset_dir: Dataset directory for this run
    
    Returns:
        RunMetadata if found, None otherwise
    """
    metadata_path = dataset_dir / "run_metadata.json"
    if not metadata_path.exists():
        return None
    
    with open(metadata_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Reconstruct dataclasses
    params = RunParams(**data["params"])
    stats = RunStats(**data["stats"]) if data.get("stats") else None
    status = RunStatus(data["status"])
    
    return RunMetadata(
        run_id=data["run_id"],
        created_at=data["created_at"],
        vod_url=data["vod_url"],
        streamer=data["streamer"],
        vod_identifier=data.get("vod_identifier"),
        status=status,
        params=params,
        stats=stats,
        segments_manifest=data.get("segments_manifest"),
        clean_audio=data.get("clean_audio"),
        error_message=data.get("error_message"),
        completed_at=data.get("completed_at"),
    )


def list_runs(dataset_root: Path, streamer: str) -> List[RunMetadata]:
    """
    List all runs for a specific streamer.
    
    Args:
        dataset_root: Base dataset directory
        streamer: Streamer slug
    
    Returns:
        List of RunMetadata, sorted by creation time (newest first)
    """
    runs_dir = dataset_root / streamer / "runs"
    if not runs_dir.exists():
        return []
    
    runs = []
    for run_dir in runs_dir.iterdir():
        if not run_dir.is_dir():
            continue
        
        metadata = load_run_metadata(run_dir)
        if metadata:
            runs.append(metadata)
    
    # Sort by creation time, newest first
    runs.sort(key=lambda r: r.created_at, reverse=True)
    return runs


def get_legacy_run_metadata(dataset_dir: Path, vod_url: str, streamer: str) -> Optional[RunMetadata]:
    """
    Create metadata for legacy flat-structure runs (backward compatibility).
    
    Args:
        dataset_dir: Legacy dataset directory (flat structure)
        vod_url: VOD URL
        streamer: Streamer slug
    
    Returns:
        RunMetadata representing the legacy run, or None if no segments found
    """
    segments_file = None
    for pattern in ["*_segments.json", "segments.json"]:
        matches = list(dataset_dir.glob(pattern))
        if matches:
            segments_file = matches[0]
            break
    
    if not segments_file or not segments_file.exists():
        return None
    
    # Try to load segments to get stats
    try:
        with open(segments_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        segments = data.get("segments", [])
        kept = sum(1 for s in segments if s.get("kept", False))
        total_dur = sum(s.get("duration", 0) or s.get("dur", 0) for s in segments)
        clean_dur = sum(s.get("duration", 0) or s.get("dur", 0) for s in segments if s.get("kept", False))
        
        stats = RunStats(
            total_segments=len(segments),
            kept_segments=kept,
            total_duration=total_dur,
            clean_duration=clean_dur,
        )
    except Exception:
        stats = None
    
    # Legacy runs don't have explicit params, use defaults
    params = RunParams(
        mode="auto",
        preset="balanced",
        strictness=0.5,
        extract_vocals=False,
        preserve_pauses=False,
        reduce_sfx=False,
        target_lufs=-16.0,
        true_peak_limit_db=-1.0,
        fade_ms=5,
    )
    
    # Use file modification time as creation time
    created_at = datetime.fromtimestamp(segments_file.stat().st_mtime).isoformat()
    
    return RunMetadata(
        run_id="default",
        created_at=created_at,
        vod_url=vod_url,
        streamer=streamer,
        vod_identifier=None,
        status=RunStatus.COMPLETED,
        params=params,
        stats=stats,
        segments_manifest=segments_file.name,
        clean_audio=None,
    )


def delete_run(dataset_root: Path, streamer: str, run_id: str) -> bool:
    """
    Delete a run and all its associated files.
    
    Args:
        dataset_root: Base dataset directory
        streamer: Streamer slug
        run_id: Run identifier
    
    Returns:
        True if deleted successfully, False if run not found
    """
    import shutil
    
    run_dir = dataset_root / streamer / "runs" / run_id
    if not run_dir.exists():
        return False
    
    shutil.rmtree(run_dir)
    return True
