"""Validation helpers for API route handlers."""

from fastapi import HTTPException

from streamcraft.api.common.run_scope import require_run_id


def require_run_id_or_400(run_id: str | None, route_name: str) -> str:
    try:
        return require_run_id(run_id, route_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
