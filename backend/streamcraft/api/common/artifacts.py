"""Helpers for writing run artifact metadata."""

import datetime
import json
from pathlib import Path

from streamcraft.api.common.paths import to_workspace_relative


def merge_run_stage_artifacts(
    *,
    vod_url: str,
    out_root: Path,
    dataset_root: Path,
    run_id: str,
    stage: str,
    payload: dict,
) -> None:
    from streamcraft.core.pipeline import resolve_output_dirs, describe_vod, slugify_label

    streamer, vod_identifier = describe_vod(vod_url)
    streamer_slug = slugify_label(streamer, "unknown")
    _, _, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = dataset_dir / "run_metadata.json"

    now = datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")
    current: dict = {}
    if metadata_path.exists():
        try:
            current = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            current = {}

    if not current:
        current = {
            "run_id": run_id,
            "created_at": now,
            "vod_url": vod_url,
            "streamer": streamer_slug,
            "vod_identifier": vod_identifier,
            "status": "in_progress",
            "params": {},
            "stats": {},
        }

    artifacts = current.setdefault("artifacts", {})
    payload_with_paths = dict(payload)
    for key, value in payload_with_paths.items():
        if isinstance(value, Path):
            payload_with_paths[key] = to_workspace_relative(value)
    artifacts[stage] = payload_with_paths
    current["updated_at"] = now
    metadata_path.write_text(json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8")
