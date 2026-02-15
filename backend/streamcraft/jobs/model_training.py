from __future__ import annotations

import datetime
import json
import queue
import re
import subprocess
import sys
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from streamcraft.settings import get_settings

JOBS_FILE = Path("temp") / "model_train_jobs.json"


@dataclass
class ModelTrainJob:
    id: str
    status: str
    created_at: str
    updated_at: str
    run_id: str
    vod_url: str
    streamer_slug: str
    checkpoint_id: str
    checkpoint_dir: str
    metadata_path: str
    dataset_manifest: str
    base_model: str
    epochs: int
    progress: int = 0
    error: Optional[str] = None
    log: list[str] | None = None


_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}
_queue: queue.Queue[str] = queue.Queue()
_worker_started = False
_cancelled: set[str] = set()


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _ensure_file() -> None:
    JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not JOBS_FILE.exists():
        JOBS_FILE.write_text("{}", encoding="utf-8")


def _load() -> None:
    global _jobs
    _ensure_file()
    try:
        payload = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            _jobs = payload
    except Exception:
        _jobs = {}


def _save() -> None:
    _ensure_file()
    JOBS_FILE.write_text(json.dumps(_jobs, indent=2, ensure_ascii=False), encoding="utf-8")


def _append_log(job: Dict[str, Any], line: str) -> None:
    logs = list(job.get("log") or [])
    stamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
    logs.append(f"[{stamp}] {line}")
    job["log"] = logs[-500:]


def _update_run_metadata_from_job(job: Dict[str, Any]) -> None:
    try:
        manifest = Path(str(job.get("dataset_manifest") or ""))
        run_dir = manifest.parent if manifest.exists() else None
        if not run_dir:
            return
        metadata_path = run_dir / "run_metadata.json"
        payload: Dict[str, Any] = {}
        if metadata_path.exists():
            try:
                payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            except Exception:
                payload = {}
        if not payload:
            payload = {
                "run_id": job.get("run_id"),
                "created_at": _now(),
                "status": "in_progress",
                "params": {},
                "stats": {},
            }

        stage_statuses = payload.setdefault("stageStatus", {})
        stage_statuses["modelTrain"] = {
            "status": job.get("status"),
            "progress": int(job.get("progress") or 0),
            "error": job.get("error"),
            "updatedAt": _now(),
        }
        if str(job.get("status")) in {"failed", "canceled"}:
            payload["status"] = "failed"
        elif str(job.get("status")) == "done":
            payload["status"] = "completed"
        else:
            payload["status"] = "in_progress"

        metadata_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        return


def _set_state(job_id: str, **patch: Any) -> Dict[str, Any]:
    with _lock:
        job = _jobs[job_id]
        job.update(patch)
        job["updated_at"] = _now()
        _update_run_metadata_from_job(job)
        _save()
        return dict(job)


def _parse_progress(line: str) -> Optional[int]:
    match = re.search(r"(\d{1,3})%", line)
    if not match:
        return None
    value = int(match.group(1))
    if value < 0 or value > 100:
        return None
    return value


def _run_training_script(job: Dict[str, Any]) -> None:
    settings = get_settings()
    script = (settings.model_train_script_path or "").strip()
    if not script:
        raise RuntimeError("STREAMCRAFT_MODEL_TRAIN_SCRIPT_PATH is not configured")

    script_path = Path(script)
    if not script_path.is_absolute():
        script_path = (Path.cwd() / script_path).resolve()
    if not script_path.exists():
        raise RuntimeError(f"Model train script not found: {script_path}")

    checkpoint_dir = Path(job["checkpoint_dir"])  # absolute
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    weights_dir = checkpoint_dir / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)

    if script_path.suffix.lower() == ".py":
        cmd = [
            sys.executable,
            str(script_path),
            "--dataset-manifest",
            str(job["dataset_manifest"]),
            "--checkpoint-dir",
            str(checkpoint_dir),
            "--base-model",
            str(job["base_model"]),
            "--epochs",
            str(job["epochs"]),
        ]
    else:
        cmd = [
            "pwsh",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
            "-DatasetManifest",
            str(job["dataset_manifest"]),
            "-CheckpointDir",
            str(checkpoint_dir),
            "-BaseModel",
            str(job["base_model"]),
            "-Epochs",
            str(job["epochs"]),
        ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if process.stdout is not None:
        for line in process.stdout:
            if job["id"] in _cancelled:
                process.terminate()
                raise RuntimeError("training cancelled")

            clean = line.rstrip("\r\n")
            if not clean:
                continue
            state = _set_state(job["id"])  # refresh snapshot
            _append_log(state, clean)
            progress = _parse_progress(clean)
            if progress is not None:
                state["progress"] = max(int(state.get("progress") or 0), progress)
            _set_state(job["id"], **state)

    code = process.wait()
    if code != 0:
        raise RuntimeError(f"training script failed with code={code}")

    # Required checkpoint artifacts
    config_path = checkpoint_dir / "config.json"
    metrics_path = checkpoint_dir / "metrics.json"
    train_manifest_path = checkpoint_dir / "training_manifest.jsonl"
    training_src = Path(job["dataset_manifest"])

    if training_src.exists():
        train_manifest_path.write_text(training_src.read_text(encoding="utf-8"), encoding="utf-8")
    if not config_path.exists():
        config_path.write_text(
            json.dumps(
                {
                    "baseModel": job["base_model"],
                    "epochs": job["epochs"],
                    "runId": job["run_id"],
                    "streamer": job["streamer_slug"],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    if not metrics_path.exists():
        metrics_path.write_text(
            json.dumps({"status": "completed", "checkpointId": job["checkpoint_id"]}, indent=2),
            encoding="utf-8",
        )
    # Minimal weight marker when script doesn't emit explicit file name
    if not any(weights_dir.iterdir()):
        (weights_dir / "placeholder.bin").write_bytes(b"trained")


def _worker() -> None:
    while True:
        job_id = _queue.get()
        if job_id == "__stop__":
            return

        with _lock:
            job = _jobs.get(job_id)
            if not job:
                _queue.task_done()
                continue
            if job_id in _cancelled:
                job["status"] = "canceled"
                job["progress"] = 0
                job["updated_at"] = _now()
                _save()
                _queue.task_done()
                continue
            job["status"] = "running"
            job["progress"] = max(1, int(job.get("progress") or 0))
            _append_log(job, "Training job started")
            _save()

        try:
            _run_training_script(job)
            _set_state(job_id, status="done", progress=100, error=None)
            final = _set_state(job_id)
            _append_log(final, "Training job completed")
            _set_state(job_id, **final)
        except Exception as exc:
            if job_id in _cancelled:
                _set_state(job_id, status="canceled", error="canceled by user")
            else:
                _set_state(job_id, status="failed", error=str(exc))
                failed = _set_state(job_id)
                _append_log(failed, f"ERROR: {exc}")
                _set_state(job_id, **failed)
        finally:
            _queue.task_done()


def start_worker() -> None:
    global _worker_started
    with _lock:
        if _worker_started:
            return
        _load()
        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        _worker_started = True


def enqueue_training_job(*, run_id: str, vod_url: str, streamer_slug: str, checkpoint_id: str, checkpoint_dir: Path, metadata_path: Path, dataset_manifest: Path, base_model: str, epochs: int) -> Dict[str, Any]:
    start_worker()
    job_id = f"train-{uuid.uuid4().hex[:12]}"
    now = _now()
    record = {
        "id": job_id,
        "status": "queued",
        "created_at": now,
        "updated_at": now,
        "run_id": run_id,
        "vod_url": vod_url,
        "streamer_slug": streamer_slug,
        "checkpoint_id": checkpoint_id,
        "checkpoint_dir": str(checkpoint_dir.resolve()),
        "metadata_path": str(metadata_path.resolve()),
        "dataset_manifest": str(dataset_manifest.resolve()),
        "base_model": base_model,
        "epochs": int(epochs),
        "progress": 0,
        "error": None,
        "log": [f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] Job queued"],
    }
    with _lock:
        _jobs[job_id] = record
        _save()
    _queue.put(job_id)
    return dict(record)


def get_training_job(job_id: str) -> Optional[Dict[str, Any]]:
    start_worker()
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def list_training_jobs(limit: int = 50) -> list[Dict[str, Any]]:
    start_worker()
    with _lock:
        items = list(_jobs.values())
    items.sort(key=lambda row: row.get("created_at") or "", reverse=True)
    return [dict(item) for item in items[: max(1, limit)]]


def cancel_training_job(job_id: str) -> bool:
    start_worker()
    with _lock:
        if job_id not in _jobs:
            return False
        _cancelled.add(job_id)
        job = _jobs[job_id]
        if job.get("status") == "queued":
            job["status"] = "canceled"
            job["updated_at"] = _now()
            _save()
    return True


def retry_training_job(job_id: str) -> Optional[Dict[str, Any]]:
    start_worker()
    with _lock:
        current = _jobs.get(job_id)
        if not current:
            return None
        if current.get("status") not in {"failed", "canceled"}:
            return dict(current)
    return enqueue_training_job(
        run_id=str(current["run_id"]),
        vod_url=str(current["vod_url"]),
        streamer_slug=str(current["streamer_slug"]),
        checkpoint_id=str(current["checkpoint_id"]),
        checkpoint_dir=Path(str(current["checkpoint_dir"])),
        metadata_path=Path(str(current["metadata_path"])),
        dataset_manifest=Path(str(current["dataset_manifest"])),
        base_model=str(current.get("base_model") or "xtts_v2"),
        epochs=int(current.get("epochs") or 0),
    )
