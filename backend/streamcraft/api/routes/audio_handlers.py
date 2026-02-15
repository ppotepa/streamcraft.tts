"""Audio route handlers."""

import asyncio
import datetime
import os
import subprocess
import sys
from pathlib import Path

from fastapi import HTTPException

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.models.api import RunAudioRequest, RunAudioResponse
from streamcraft.settings import get_settings


async def run_audio(request: RunAudioRequest) -> RunAudioResponse:
    """Extract audio from VOD."""
    try:
        from streamcraft.core.pipeline import configure_temp_dir, resolve_output_dirs
        from streamcraft.core.transcribe import extract_audio

        configure_temp_dir(Path.cwd())

        vod_url = request.vodUrl
        run_id = require_run_id_or_400(request.runId, "/audio/run")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")

        _, vod_dir, _ = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
        vod_dir.mkdir(parents=True, exist_ok=True)

        log_buffer: list[str] = []

        def log(message: str) -> None:
            timestamp = datetime.datetime.now(datetime.UTC).strftime("%H:%M:%S")
            entry = f"[{timestamp}] {message}"
            log_buffer.append(entry)

        def download_with_fallback(url: str, out_dir: Path, quality: str, auth_token: str | None) -> Path:
            out_dir.mkdir(parents=True, exist_ok=True)
            import re

            match = re.search(r"(\d{6,})", url)
            base = match.group(1) if match else "vod"
            target = out_dir / f"{base}.mp4"

            if target.exists() and not request.force:
                return target

            qualities: list[str] = []
            seen: set[str] = set()
            for level in [quality, "audio_only", "source", "720p", "1080p"]:
                if level and level not in seen:
                    qualities.append(level)
                    seen.add(level)

            last_err = None
            for level in qualities:
                if target.exists():
                    try:
                        target.unlink()
                    except Exception:
                        pass
                command = [
                    sys.executable,
                    "-m",
                    "twitchdl",
                    "download",
                    url,
                    "-o",
                    str(target),
                    "--overwrite",
                    "--quality",
                    level,
                ]
                if auth_token:
                    command.extend(["--auth-token", auth_token])

                log(f"twitchdl try quality={level}: {' '.join(command)}")
                result = subprocess.run(command, capture_output=True, text=True)
                if result.returncode == 0 and target.exists():
                    return target

                err_text = (result.stderr or result.stdout or "").strip()
                last_err = f"quality={level} code={result.returncode} {err_text}"
                log(f"twitchdl failed: {last_err}")

            raise RuntimeError(f"twitchdl failed for all qualities. Last error: {last_err or 'unknown'}")

        log("Ensuring VOD media is ready...")
        settings = get_settings()
        auth_token = request.authToken or os.environ.get("TWITCHDL_AUTH_TOKEN")
        quality = request.vodQuality or settings.vod_quality
        download_target = await asyncio.to_thread(download_with_fallback, vod_url, vod_dir, quality, auth_token)
        log(f"VOD ready at {download_target}")

        log("Extracting PCM audio via ffmpeg...")
        audio_full, _ = await asyncio.to_thread(extract_audio, download_target, vod_dir)
        log(f"Audio ready {audio_full}")

        merge_run_stage_artifacts(
            vod_url=vod_url,
            out_root=out_root,
            dataset_root=dataset_root,
            run_id=run_id,
            stage="audio",
            payload={
                "mediaPath": to_workspace_relative(download_target),
                "audioFullPath": to_workspace_relative(audio_full),
            },
        )

        return RunAudioResponse(path=to_workspace_relative(audio_full), exitCode=0, log=log_buffer)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio extraction failed: {exc}")
