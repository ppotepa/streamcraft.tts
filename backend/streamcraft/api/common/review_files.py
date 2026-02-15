"""Helpers for sanitize review and manifest payload files."""

import json
from pathlib import Path

from fastapi import HTTPException


def load_review_payload(review_path: Path) -> dict:
    if not review_path.exists():
        raise FileNotFoundError("Segment review not found; run swipe review first")
    try:
        return json.loads(review_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted review file: {exc}")


def load_manifest_payload(manifest_path: Path) -> dict:
    if not manifest_path.exists():
        raise FileNotFoundError("Sanitize manifest missing; run sanitize first")
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted manifest: {exc}")
