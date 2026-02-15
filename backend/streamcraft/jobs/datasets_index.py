"""Dataset index utilities for streamer/run discovery."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DATASETS_INDEX_FILE = Path("temp") / "datasets_index.json"


def _ensure_index_file() -> None:
    DATASETS_INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATASETS_INDEX_FILE.exists():
        DATASETS_INDEX_FILE.write_text("[]", encoding="utf-8")


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _to_iso_or_none(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            datetime.fromisoformat(value)
        return value
    except Exception:
        return None


def _count_clips(clips_dir: Path) -> int:
    if not clips_dir.exists() or not clips_dir.is_dir():
        return 0
    wav = len(list(clips_dir.glob("*.wav")))
    m4a = len(list(clips_dir.glob("*.m4a")))
    return wav + m4a


def _to_rel(path_value: Path, workspace_root: Path) -> str:
    resolved = path_value.resolve(strict=False)
    try:
        return resolved.relative_to(workspace_root).as_posix()
    except Exception:
        return resolved.as_posix()


def _build_run_record(streamer_slug: str, run_dir: Path, out_root: Path, workspace_root: Path) -> Dict[str, Any]:
    metadata = _read_json(run_dir / "run_metadata.json") or {}

    run_id = str(metadata.get("run_id") or run_dir.name)
    created_at = _to_iso_or_none(metadata.get("created_at"))
    status = str(metadata.get("status") or "unknown")
    vod_url = metadata.get("vod_url")
    vod_identifier = metadata.get("vod_identifier")

    clips_dir = run_dir / "clips"
    manifest_csv = run_dir / "manifest.csv"
    segments_manifest_name = metadata.get("segments_manifest")
    segments_manifest = run_dir / segments_manifest_name if segments_manifest_name else None
    if not segments_manifest or not segments_manifest.exists():
        candidates = sorted(run_dir.glob("*_segments.json"))
        segments_manifest = candidates[0] if candidates else None

    tts_dir = out_root / streamer_slug / "tts"
    tts_files = sorted(tts_dir.glob("*.wav"), key=lambda p: p.stat().st_mtime, reverse=True) if tts_dir.exists() else []

    return {
        "datasetId": f"{streamer_slug}:{run_id}",
        "streamer": streamer_slug,
        "runId": run_id,
        "status": status,
        "createdAt": created_at,
        "vodUrl": vod_url,
        "vodId": vod_identifier,
        "datasetPath": _to_rel(run_dir, workspace_root),
        "clipsPath": _to_rel(clips_dir, workspace_root) if clips_dir.exists() else None,
        "clipsCount": _count_clips(clips_dir),
        "manifestPath": _to_rel(manifest_csv, workspace_root) if manifest_csv.exists() else None,
        "segmentsPath": _to_rel(segments_manifest, workspace_root) if segments_manifest and segments_manifest.exists() else None,
        "latestTtsPath": _to_rel(tts_files[0], workspace_root) if tts_files else None,
        "hasTrainArtifacts": clips_dir.exists() and manifest_csv.exists(),
        "hasTtsArtifacts": bool(tts_files),
        "params": metadata.get("params") or {},
        "stats": metadata.get("stats") or {},
    }


def _build_legacy_record(streamer_slug: str, streamer_dir: Path, out_root: Path, workspace_root: Path) -> Optional[Dict[str, Any]]:
    clips_dir = streamer_dir / "clips"
    manifest_csv = streamer_dir / "manifest.csv"
    segment_candidates = sorted(streamer_dir.glob("*_segments.json"))
    segments_manifest = segment_candidates[0] if segment_candidates else None

    has_any = clips_dir.exists() or manifest_csv.exists() or segments_manifest is not None
    if not has_any:
        return None

    tts_dir = out_root / streamer_slug / "tts"
    tts_files = sorted(tts_dir.glob("*.wav"), key=lambda p: p.stat().st_mtime, reverse=True) if tts_dir.exists() else []

    return {
        "datasetId": f"{streamer_slug}:legacy",
        "streamer": streamer_slug,
        "runId": None,
        "status": "legacy",
        "createdAt": None,
        "vodUrl": None,
        "vodId": None,
        "datasetPath": _to_rel(streamer_dir, workspace_root),
        "clipsPath": _to_rel(clips_dir, workspace_root) if clips_dir.exists() else None,
        "clipsCount": _count_clips(clips_dir),
        "manifestPath": _to_rel(manifest_csv, workspace_root) if manifest_csv.exists() else None,
        "segmentsPath": _to_rel(segments_manifest, workspace_root) if segments_manifest else None,
        "latestTtsPath": _to_rel(tts_files[0], workspace_root) if tts_files else None,
        "hasTrainArtifacts": clips_dir.exists() and manifest_csv.exists(),
        "hasTtsArtifacts": bool(tts_files),
        "params": {},
        "stats": {},
    }


def build_datasets_index(dataset_root: Path, out_root: Path, workspace_root: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    if not dataset_root.exists():
        return records

    for streamer_dir in sorted([p for p in dataset_root.iterdir() if p.is_dir()]):
        streamer_slug = streamer_dir.name
        runs_dir = streamer_dir / "runs"
        if runs_dir.exists() and runs_dir.is_dir():
            run_dirs = sorted([p for p in runs_dir.iterdir() if p.is_dir()], reverse=True)
            for run_dir in run_dirs:
                records.append(_build_run_record(streamer_slug, run_dir, out_root, workspace_root))

        legacy_record = _build_legacy_record(streamer_slug, streamer_dir, out_root, workspace_root)
        if legacy_record:
            records.append(legacy_record)

    records.sort(key=lambda item: (item.get("createdAt") or "", item.get("runId") or ""), reverse=True)
    return records


def refresh_datasets_index(dataset_root: Path, out_root: Path, workspace_root: Path) -> List[Dict[str, Any]]:
    records = build_datasets_index(dataset_root, out_root, workspace_root)
    _ensure_index_file()
    DATASETS_INDEX_FILE.write_text(json.dumps(records, indent=2), encoding="utf-8")
    return records


def get_datasets_index(dataset_root: Path, out_root: Path, workspace_root: Path, refresh: bool = False) -> List[Dict[str, Any]]:
    if refresh:
        return refresh_datasets_index(dataset_root, out_root, workspace_root)

    _ensure_index_file()
    try:
        data = json.loads(DATASETS_INDEX_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception:
        pass

    return refresh_datasets_index(dataset_root, out_root, workspace_root)


def summarize_streamers(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_streamer: Dict[str, Dict[str, Any]] = {}
    for item in records:
        streamer = item.get("streamer") or "unknown"
        bucket = by_streamer.setdefault(
            streamer,
            {
                "streamer": streamer,
                "datasets": 0,
                "runs": 0,
                "latestRunAt": None,
                "latestTtsPath": None,
            },
        )
        bucket["datasets"] += 1
        if item.get("runId"):
            bucket["runs"] += 1
        created_at = item.get("createdAt")
        if created_at and (bucket["latestRunAt"] is None or created_at > bucket["latestRunAt"]):
            bucket["latestRunAt"] = created_at
        if item.get("latestTtsPath") and not bucket["latestTtsPath"]:
            bucket["latestTtsPath"] = item.get("latestTtsPath")

    return sorted(by_streamer.values(), key=lambda row: (row.get("latestRunAt") or "", row["streamer"]), reverse=True)
