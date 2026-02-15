"""Path helpers shared by API route modules."""

from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[4]


def to_workspace_relative(path_value: Path) -> str:
    resolved = path_value.resolve(strict=False)
    try:
        rel = resolved.relative_to(WORKSPACE_ROOT)
    except ValueError:
        rel = resolved
    return rel.as_posix()


def resolve_artifact_path(path_value: str) -> Path:
    candidate = Path(path_value)
    if not candidate.is_absolute():
        candidate = (WORKSPACE_ROOT / candidate).resolve()
    else:
        candidate = candidate.resolve()
    try:
        candidate.relative_to(WORKSPACE_ROOT)
    except ValueError as exc:
        raise ValueError("Path outside workspace") from exc
    if not candidate.exists():
        raise FileNotFoundError("Artifact not found")
    return candidate
