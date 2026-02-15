"""Artifact route handlers."""

from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from streamcraft.api.common.paths import resolve_artifact_path as resolve_artifact_path_common


def resolve_artifact_path(path_value: str) -> Path:
    try:
        return resolve_artifact_path_common(path_value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path outside workspace")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Artifact not found")


async def get_artifact(path: str):
    target = resolve_artifact_path(path)
    media_type = "application/octet-stream"
    if target.suffix.lower() == ".wav":
        media_type = "audio/wav"
    return FileResponse(target, media_type=media_type, filename=target.name)
