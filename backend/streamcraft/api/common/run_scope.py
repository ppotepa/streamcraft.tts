"""Run-scoped helper functions for API routes."""

from pathlib import Path


def require_run_id(run_id: str | None, route_name: str) -> str:
    value = (run_id or "").strip()
    if not value:
        raise ValueError(f"runId is required for {route_name}")
    return value


def segment_review_path(vod_url: str, out_root: Path, dataset_root: Path, run_id: str) -> Path:
    from streamcraft.core.pipeline import resolve_output_dirs

    _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
    vod_slug = vod_dir.name
    return dataset_dir / f"{vod_slug}_segment_review.json"
