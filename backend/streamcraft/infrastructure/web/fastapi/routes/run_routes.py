"""FastAPI routes for VOD run management."""

from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from streamcraft.core.pipeline import describe_vod, resolve_output_dirs
from streamcraft.core.run_manager import (
    RunMetadata,
    delete_run,
    get_legacy_run_metadata,
    list_runs,
    load_run_metadata,
)
from streamcraft.settings import get_settings


router = APIRouter(prefix="/vods", tags=["vods", "runs"])


class RunMetadataResponse(BaseModel):
    """API response model for run metadata."""
    run_id: str
    created_at: str
    vod_url: str
    streamer: str
    vod_identifier: Optional[str]
    status: str
    params: dict
    stats: Optional[dict]
    segments_manifest: Optional[str]
    clean_audio: Optional[str]
    error_message: Optional[str]
    completed_at: Optional[str]


class RunListResponse(BaseModel):
    """API response for list of runs."""
    runs: List[RunMetadataResponse]
    total: int


def _to_response(metadata: RunMetadata) -> RunMetadataResponse:
    """Convert internal RunMetadata to API response."""
    return RunMetadataResponse(
        run_id=metadata.run_id,
        created_at=metadata.created_at,
        vod_url=metadata.vod_url,
        streamer=metadata.streamer,
        vod_identifier=metadata.vod_identifier,
        status=metadata.status.value,
        params={
            "mode": metadata.params.mode,
            "preset": metadata.params.preset,
            "strictness": metadata.params.strictness,
            "extract_vocals": metadata.params.extract_vocals,
            "preserve_pauses": metadata.params.preserve_pauses,
            "reduce_sfx": metadata.params.reduce_sfx,
            "target_lufs": metadata.params.target_lufs,
            "true_peak_limit_db": metadata.params.true_peak_limit_db,
            "fade_ms": metadata.params.fade_ms,
            "voice_sample_count": metadata.params.voice_sample_count,
            "voice_sample_min_duration": metadata.params.voice_sample_min_duration,
            "voice_sample_max_duration": metadata.params.voice_sample_max_duration,
            "voice_sample_min_rms_db": metadata.params.voice_sample_min_rms_db,
        },
        stats={
            "total_segments": metadata.stats.total_segments,
            "kept_segments": metadata.stats.kept_segments,
            "total_duration": metadata.stats.total_duration,
            "clean_duration": metadata.stats.clean_duration,
            "rejection_reasons": metadata.stats.rejection_reasons,
        } if metadata.stats else None,
        segments_manifest=metadata.segments_manifest,
        clean_audio=metadata.clean_audio,
        error_message=metadata.error_message,
        completed_at=metadata.completed_at,
    )


@router.get("/runs")
async def list_vod_runs(
    vod_url: str = Query(..., description="VOD URL to list runs for"),
    dataset_out: str = Query("dataset", description="Dataset root directory"),
) -> RunListResponse:
    """List all runs for a specific VOD."""
    try:
        # Determine streamer from VOD URL
        streamer, _ = describe_vod(vod_url)
        if not streamer or streamer == "unknown":
            raise HTTPException(status_code=400, detail="Cannot determine streamer from VOD URL")
        
        dataset_root = Path(dataset_out)
        runs = list_runs(dataset_root, streamer)
        
        # Also check for legacy flat-structure run
        legacy_dataset_dir = dataset_root / streamer
        if legacy_dataset_dir.exists():
            legacy_run = get_legacy_run_metadata(legacy_dataset_dir, vod_url, streamer)
            if legacy_run:
                runs.append(legacy_run)
        
        return RunListResponse(
            runs=[_to_response(r) for r in runs],
            total=len(runs),
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list runs: {str(e)}")


@router.get("/runs/{run_id}")
async def get_vod_run(
    run_id: str,
    vod_url: str = Query(..., description="VOD URL"),
    dataset_out: str = Query("dataset", description="Dataset root directory"),
) -> RunMetadataResponse:
    """Get metadata for a specific run."""
    try:
        streamer, _ = describe_vod(vod_url)
        if not streamer or streamer == "unknown":
            raise HTTPException(status_code=400, detail="Cannot determine streamer from VOD URL")
        
        dataset_root = Path(dataset_out)
        
        # Handle legacy "default" run
        if run_id == "default":
            legacy_dataset_dir = dataset_root / streamer
            metadata = get_legacy_run_metadata(legacy_dataset_dir, vod_url, streamer)
            if not metadata:
                raise HTTPException(status_code=404, detail="Legacy run not found")
            return _to_response(metadata)
        
        # Handle versioned runs
        run_dir = dataset_root / streamer / "runs" / run_id
        if not run_dir.exists():
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        
        metadata = load_run_metadata(run_dir)
        if not metadata:
            raise HTTPException(status_code=404, detail=f"Run metadata not found for {run_id}")
        
        return _to_response(metadata)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load run: {str(e)}")


@router.delete("/runs/{run_id}")
async def delete_vod_run(
    run_id: str,
    vod_url: str = Query(..., description="VOD URL"),
    dataset_out: str = Query("dataset", description="Dataset root directory"),
) -> dict:
    """Delete a specific run."""
    try:
        if run_id == "default":
            raise HTTPException(status_code=400, detail="Cannot delete legacy default run")
        
        streamer, _ = describe_vod(vod_url)
        if not streamer or streamer == "unknown":
            raise HTTPException(status_code=400, detail="Cannot determine streamer from VOD URL")
        
        dataset_root = Path(dataset_out)
        success = delete_run(dataset_root, streamer, run_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        
        return {"success": True, "message": f"Run {run_id} deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete run: {str(e)}")
